import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { notifyAdmins } from '../notifications';
import { alertRefundRequested } from '../notifications/admin-alerts';
import { addressesService, type ResolvedAddress } from '../addresses/addresses.service';
import { bookingsRepository } from './bookings.repository';
import type { ListBookingsQuery } from './bookings.query';
import { bookingSettings } from './bookings.settings';
import { withSlotLock } from './bookings.lock';
import { buildDetailView, INTERNAL_KEYS, type PaymentInfo, type ServiceInfo } from './bookings.detail';
import { buildInvoiceData, renderInvoiceHtml, withPaymentRecord } from './bookings.invoice';
import { PaymentModel } from '../../models/Payment';
import {
  BOOKING_HOLD_MS,
  BOOKING_STATUS,
  BOOKING_WINDOW_DAYS,
  PRICE_CHANGED_TOLERANCE,
  RESCHEDULABLE_STATUSES,
  SERVICE_SLOTS,
  START_OTP_STATUS,
  type BookingStatus,
} from './bookings.constants';
import { canTransition, type StatusHistoryEntry } from './bookings.stateMachine';
import { computeCancellation, type CancellationQuote } from './bookings.cancel';
import type { CreateBookingInput, PriceLine, PriceSnapshot } from './bookings.types';
import { addDays, hasSlotStarted, isRealDate, nowInBookingTz } from './bookings.time';
import { BOOKING_PAYMENT_STATUS } from '../../models/Booking';
import { ServiceModel } from '../../models/Service';
import { calculatePricing, toQuoteCouponCode } from '../pricing/pricing.service';
import { couponsService } from '../coupons/coupons.service';
import { HttpError } from '../auth/auth.types';

export interface SlotAvailability {
  slot: string;
  available: boolean;
  remaining: number;
}

export interface SlotsResponse {
  serviceId: string;
  date: string;
  slots: SlotAvailability[];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertBookableDate(date: string): void {
  const now = nowInBookingTz();
  const lastBookable = addDays(now.date, BOOKING_WINDOW_DAYS - 1);
  if (!isRealDate(date) || date < now.date || date > lastBookable) {
    throw new AppError(400, 'INVALID_DATE', `Pick a date between ${now.date} and ${lastBookable}`);
  }
}

/** A mongoose document (or plain object) as a plain object. */
function rawObject(doc: unknown): Record<string, unknown> {
  const d = doc as { toObject?: () => Record<string, unknown> };
  return typeof d?.toObject === 'function' ? d.toObject() : { ...(doc as Record<string, unknown>) };
}

/** Catalog details for the details page. Best effort: a missing or deleted service never breaks the booking. */
async function loadServiceInfo(serviceId: unknown, serviceName?: unknown): Promise<ServiceInfo | null> {
  const hasId = Boolean(serviceId) && Types.ObjectId.isValid(String(serviceId));
  if (!hasId && (typeof serviceName !== 'string' || !serviceName.trim())) return null;
  try {
    const query = hasId
      ? ServiceModel.findById(String(serviceId))
      : ServiceModel.findOne({ name: String(serviceName).trim() });
    const svc = (await query
      .select('name description durationMinutes media categoryId')
      .populate('categoryId', 'name')
      .lean()
      .exec()) as {
      name?: string;
      description?: string;
      durationMinutes?: number;
      media?: Array<{ url?: string }>;
      categoryId?: { name?: string } | null;
    } | null;
    if (!svc) return null;
    return {
      name: svc.name,
      description: svc.description || undefined,
      durationMinutes: svc.durationMinutes,
      image: svc.media?.[0]?.url || undefined,
      categoryName: svc.categoryId && typeof svc.categoryId === 'object' ? svc.categoryId.name : undefined,
    };
  } catch {
    return null;
  }
}

/** The latest payment attempt, preferring a paid one. Best effort. */
async function loadPaymentInfo(bookingId: string): Promise<PaymentInfo | null> {
  try {
    const rows = await PaymentModel.find({ bookingId: new Types.ObjectId(bookingId) })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .exec();
    const pick = rows.find((r) => r.status === 'PAID') ?? rows[0];
    if (!pick) return null;
    return { status: pick.status, method: pick.method, transactionId: pick.razorpayPaymentId, paidAt: pick.paidAt };
  } catch {
    return null;
  }
}

function toView(doc: { toObject?: () => Record<string, unknown> } | Record<string, unknown>): Record<string, unknown> {
  const obj =
    typeof (doc as { toObject?: unknown }).toObject === 'function'
      ? (doc as { toObject: () => Record<string, unknown> }).toObject()
      : { ...(doc as Record<string, unknown>) };
  const rest = { ...obj };
  for (const key of INTERNAL_KEYS) delete rest[key];
  for (const key of ['requestHash', 'idempotencyKey', 'slotSeat', '__v', 'otp']) delete rest[key];
  if (!Array.isArray(rest.extraCharges)) rest.extraCharges = [];
  return rest;
}

/** "2026-10-01" + "10:00-12:00" -> the slot start instant in Asia/Kolkata. */
function slotStartDate(date: string, slot: string): Date {
  return new Date(`${date}T${slot.slice(0, 5)}:00+05:30`);
}

function bookingSlotStart(booking: { scheduledAt?: Date; date?: string; slot?: string }): Date {
  if (booking.scheduledAt instanceof Date && !Number.isNaN(booking.scheduledAt.getTime())) {
    return booking.scheduledAt;
  }
  if (booking.date && booking.slot) {
    const d = slotStartDate(booking.date, booking.slot);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function isDuplicateKey(err: unknown, indexName: string): boolean {
  const e = err as { code?: number; message?: string };
  return e?.code === 11000 && String(e.message ?? '').includes(indexName);
}

export interface CancellationSummary extends CancellationQuote {
  hoursUntilSlot?: number;
  /** How the money goes back: a refund request the admin team processes, or none when nothing was paid. */
  refundMethod: 'RAZORPAY' | null;
  refundStatus: 'requested' | 'none';
}

export const BookingService = {
  async getAvailableSlots(serviceId: string, date: string): Promise<SlotsResponse> {
    assertBookableDate(date);
    const capacity = await bookingSettings.getSlotCapacity(serviceId);

    const slots = await Promise.all(
      SERVICE_SLOTS.map(async (slot): Promise<SlotAvailability> => {
        if (hasSlotStarted(date, slot)) {
          return { slot, available: false, remaining: 0 };
        }
        const taken = await bookingsRepository.countActiveForSlot(serviceId, date, slot);
        const remaining = Math.max(capacity - taken, 0);
        return { slot, available: remaining > 0, remaining };
      }),
    );

    return { serviceId, date, slots };
  },

  /**
   * Fast real-time slot pre-check before advancing steps or paying
   */
  async checkSlotAvailability(serviceId: string, date: string, slot: string): Promise<SlotAvailability> {
    assertBookableDate(date);
    if (hasSlotStarted(date, slot)) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
    }
    const capacity = await bookingSettings.getSlotCapacity(serviceId);
    const taken = await bookingsRepository.countActiveForSlot(serviceId, date, slot);
    const remaining = Math.max(capacity - taken, 0);

    if (remaining <= 0) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
    }

    return { slot, available: true, remaining };
  },

  async createBooking(customerId: string, input: CreateBookingInput, idempotencyKey: string | undefined) {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key header is required to create a booking');
    }
    const requestHash = createHash('sha256').update(stableStringify(input)).digest('hex');

    const replay = async () => {
      const existing = await bookingsRepository.findByCustomerAndIdempotencyKey(customerId, idempotencyKey);
      if (!existing) return null;
      if (existing.requestHash !== requestHash) {
        throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request');
      }
      return { booking: toView(existing as never), replayed: true };
    };

    const replayed = await replay();
    if (replayed) return replayed;

    // categoryId is selected too: it is stored on the booking below.
    const row = await ServiceModel.findOne(
      { _id: input.serviceId, active: { $ne: false } },
      'name basePrice addOns categoryId',
    ).lean();
    if (!row) throw new AppError(404, 'SERVICE_NOT_FOUND', 'That service was not found');
    const service = {
      id: String(row._id),
      name: row.name,
      basePrice: row.basePrice,
      addOns: (row.addOns ?? []).map((a) => ({ id: String(a._id), name: a.name, price: a.price })),
    };

    const addOnLines: PriceLine[] = input.addOns.map((a) => {
      const addOn = service.addOns.find((x) => x.id === a.addOnId);
      if (!addOn) {
        throw new AppError(422, 'ADDON_NOT_FOUND', 'One of the selected add-ons is not available for this service', {
          addOnId: a.addOnId,
        });
      }
      return {
        kind: 'ADDON',
        refId: new Types.ObjectId(addOn.id),
        name: addOn.name,
        unitPrice: addOn.price,
        quantity: a.quantity,
        amount: addOn.price * a.quantity,
      };
    });

    if (new Set(input.addOns.map((a) => a.addOnId)).size !== input.addOns.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Each add-on can only be listed once');
    }

    assertBookableDate(input.date);
    if (hasSlotStarted(input.date, input.slot)) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
    }

    let addressSnapshot: ResolvedAddress;
    if (input.addressId) {
      addressSnapshot = await addressesService.resolveForBooking(customerId, input.addressId);
    } else if (input.newAddress) {
      await addressesService.assertServiceable(input.newAddress.pincode);
      addressSnapshot = { ...input.newAddress };
    } else {
      throw new AppError(400, 'VALIDATION_ERROR', 'Provide exactly one of addressId or newAddress');
    }

    let coupon: { code: string; discount: number } | null = null;
    if (input.couponCode) {
      try {
        coupon = await couponsService.validate(
          {
            serviceId: input.serviceId,
            quantity: input.quantity,
            addOns: input.addOns,
            date: input.date,
            slot: input.slot,
            couponCode: input.couponCode,
          },
          customerId,
        );
      } catch (err) {
        if (err instanceof HttpError) {
          throw new AppError(422, toQuoteCouponCode(err.code ?? 'COUPON_INVALID'), err.message);
        }
        throw err;
      }
    }

    const lines: PriceLine[] = [
      {
        kind: 'BASE',
        refId: new Types.ObjectId(service.id),
        name: service.name,
        unitPrice: service.basePrice,
        quantity: input.quantity,
        amount: service.basePrice * input.quantity,
      },
      ...addOnLines,
    ];
    // Same calculation as POST /pricing/quote, so the stored total is what the customer was shown.
    const pricing = calculatePricing({ lines, slot: input.slot, discount: coupon?.discount ?? 0 });
    const priceSnapshot: PriceSnapshot = {
      currency: 'INR',
      lines,
      ...pricing,
      ...(coupon ? { couponCode: coupon.code } : {}),
      computedAt: new Date(),
    };

    if (input.expectedTotal !== undefined && Math.abs(input.expectedTotal - priceSnapshot.total) > PRICE_CHANGED_TOLERANCE) {
      throw new AppError(409, 'PRICE_CHANGED', `The price changed to ₹${priceSnapshot.total}. Please review and confirm again.`, {
        expectedTotal: input.expectedTotal,
        total: priceSnapshot.total,
      });
    }

    const requirePayment = await bookingSettings.isPaymentRequired();
    const capacity = await bookingSettings.getSlotCapacity(input.serviceId);
    const initialStatus = requirePayment ? BOOKING_STATUS.PENDING_PAYMENT : BOOKING_STATUS.CONFIRMED;
    const initialPaymentStatus = BOOKING_PAYMENT_STATUS.PENDING;
    const now = new Date();

    try {
      const created = await withSlotLock(`booking:${input.serviceId}:${input.date}:${input.slot}`, async () => {
        await bookingsRepository.releaseStaleHolds(input.serviceId, input.date, input.slot, now);
        const seat = await bookingsRepository.findFreeSeat(input.serviceId, input.date, input.slot, capacity);
        if (seat === null) {
          throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
        }
        const createdBooking = await bookingsRepository.create({
          customerId: new Types.ObjectId(customerId),
          serviceId: new Types.ObjectId(input.serviceId),
          ...(row.categoryId ? { categoryId: row.categoryId } : {}),
          quantity: input.quantity,
          addOns: input.addOns.map((a) => ({ addOnId: new Types.ObjectId(a.addOnId), quantity: a.quantity })),
          addressSnapshot: {
            ...addressSnapshot,
            sourceAddressId: addressSnapshot.sourceAddressId ? new Types.ObjectId(addressSnapshot.sourceAddressId) : undefined,
          },
          // Fields read by the partner jobs/dashboard side (P02-P05).
          serviceName: service.name,
          address: {
            line1: addressSnapshot.line1,
            area: addressSnapshot.line2,
            city: addressSnapshot.city,
            pincode: addressSnapshot.pincode,
            ...(addressSnapshot.location
              ? { location: { type: 'Point', coordinates: [addressSnapshot.location.lng, addressSnapshot.location.lat] } }
              : {}),
          },
          scheduledAt: slotStartDate(input.date, input.slot),
          priceBreakdown: {
            base: lines[0].amount,
            addOns: pricing.addOnsTotal,
            surge: pricing.surge,
            discount: priceSnapshot.discount,
            convenienceFee: priceSnapshot.convenienceFee,
            tax: pricing.gst,
            total: priceSnapshot.total,
          },
          date: input.date,
          slot: input.slot,
          priceSnapshot,
          status: initialStatus,
          paymentStatus: initialPaymentStatus,
          statusHistory: [
            {
              from: null,
              to: initialStatus,
              at: now,
              actorId: customerId,
              actorRole: 'customer',
              reason: requirePayment ? 'Booking created, awaiting payment' : 'Booking confirmed',
            },
          ],
          slotSeat: seat,
          idempotencyKey,
          requestHash,
          holdExpiresAt: requirePayment ? new Date(now.getTime() + BOOKING_HOLD_MS) : undefined,
        } as never);

        if (coupon) {
          await couponsService.recordUsage(coupon.code, customerId, (createdBooking as any)._id?.toString());
        }
        return createdBooking;
      });

      // Tell the admins (bell, live). Fire-and-forget: a failed alert must never fail the booking.
      void Promise.resolve(
        notifyAdmins('booking.created', {
          bookingId: String((created as { _id?: unknown })._id ?? ''),
          serviceId: input.serviceId,
        }),
      ).catch(() => undefined);

      return { booking: toView(created as never), replayed: false };
    } catch (err) {
      if (isDuplicateKey(err, 'uniq_customer_idem_key')) {
        const raced = await replay();
        if (raced) return raced;
      }
      if (isDuplicateKey(err, 'uniq_active_slot_seat')) {
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
      }
      throw err;
    }
  },

  /**
   * One booking for its owner. A booking that belongs to someone else is indistinguishable from one
   * that does not exist: both are 404, so ids can't be probed.
   */
  async getBooking(customerId: string, bookingId: string) {
    let booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }

    if (
      booking.status === BOOKING_STATUS.PENDING_PAYMENT &&
      booking.holdExpiresAt &&
      new Date(booking.holdExpiresAt).getTime() <= Date.now()
    ) {
      await bookingsRepository.releaseStaleHolds(
        booking.serviceId ? String(booking.serviceId) : undefined,
        booking.date,
        booking.slot,
      );
      const refreshed = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
      if (refreshed) booking = refreshed;
    }

    const normalizedStatus = String(booking.status || '').toLowerCase();
    const isArrived =
      normalizedStatus === START_OTP_STATUS ||
      normalizedStatus === 'arrived' ||
      booking.status === START_OTP_STATUS;
    const startOtp = isArrived
      ? await bookingsRepository.getOrCreateStartOtp(String((booking as any)._id || bookingId))
      : null;
    const raw = rawObject(booking);
    const [service, payment] = await Promise.all([
      loadServiceInfo(raw.serviceId, raw.serviceName),
      loadPaymentInfo(bookingId),
    ]);
    return buildDetailView(raw, startOtp, { service, payment });
  },

  /** Approve or reject one pending extra charge, then return the refreshed booking. */
  async decideExtraCharge(
    customerId: string,
    bookingId: string,
    chargeId: string,
    decision: 'approve' | 'reject',
  ) {
    const next = decision === 'approve' ? 'approved' : 'rejected';
    const updated = await bookingsRepository.decideExtraCharge(bookingId, customerId, chargeId, next);

    if (!updated) {
      // Nothing was changed. Work out why so the client gets an honest answer (own bookings only).
      const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
      if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');

      const charge = (booking as any).extraCharges?.find((c: any) => String(c._id) === chargeId);
      if (!charge) throw new AppError(404, 'EXTRA_CHARGE_NOT_FOUND', 'Extra charge not found');
      if (charge.status !== 'pending') {
        throw new AppError(409, 'EXTRA_CHARGE_ALREADY_DECIDED', `This extra charge was already ${charge.status}`);
      }
      throw new AppError(
        409,
        'INVALID_STATE_TRANSITION',
        `An extra charge can't be decided while the booking is ${booking.status}`,
      );
    }

    return BookingService.getBooking(customerId, bookingId);
  },

  /**
   * The invoice (HTML) for one of the customer's own bookings.
   * 404 for someone else's booking (same answer as GET /bookings/:id, so ids can't be probed);
   * 409 until the booking is paid or settled, because there is nothing to invoice before that.
   */
  async getInvoice(customerId: string, bookingId: string): Promise<{ html: string; invoiceNo: string }> {
    const view = await BookingService.getBooking(customerId, bookingId);
    if (view.paymentStatus !== 'PAID') {
      throw new AppError(409, 'INVOICE_NOT_AVAILABLE', 'The invoice is available once the booking is paid');
    }
    const customer = (await bookingsRepository.findCustomerContact(customerId)) ?? {};
    // The booking view's payment lookup is best-effort; read the paid Payment record directly so the
    // method, transaction ID and payment date on the receipt are always filled when they exist.
    const paidRecord = await bookingsRepository.findPaidPayment(bookingId).catch(() => null);
    const data = buildInvoiceData(withPaymentRecord(view, paidRecord as never), customer);
    return { html: renderInvoiceHtml(data), invoiceNo: data.invoiceNo };
  },

  /**
   * Fee and refund summary if the customer cancelled right now.
   */
  async previewCancellation(customerId: string, bookingId: string): Promise<CancellationSummary> {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (!canTransition(booking.status as BookingStatus, 'cancelled_by_customer', 'customer')) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', `A booking in ${booking.status} cannot be cancelled`);
    }

    const policy = await bookingSettings.getCancellationPolicy();
    const paidRecord = await bookingsRepository.findPaidPayment(bookingId).catch(() => null);
    const paidAmount = paidRecord ? paidRecord.amount : 0;
    const slotStart = bookingSlotStart(booking as never);
    const now = new Date();
    const quote = computeCancellation({ slotStart, now, paidAmount, policy });
    const hoursUntilSlot = Math.max(0, Math.round((slotStart.getTime() - now.getTime()) / 3_600_000));

    return {
      ...quote,
      hoursUntilSlot,
      refundMethod: quote.refundAmount > 0 && paidRecord ? ('RAZORPAY' as const) : null,
      refundStatus: quote.refundAmount > 0 && paidRecord ? ('requested' as const) : ('none' as const),
    };
  },

  // Alias
  async previewCancel(customerId: string, bookingId: string): Promise<CancellationSummary> {
    return BookingService.previewCancellation(customerId, bookingId);
  },

  /**
   * Cancels the customer's booking. Order matters: the status moves first, atomically and through the
   * state machine (so a double tap or a partner moving the job on cannot cancel twice or after in_progress),
   * then the refund request is filed for the amount shown in the preview.
   */
  async cancelBooking(customerId: string, bookingId: string, reason: string) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (!canTransition(booking.status as BookingStatus, 'cancelled_by_customer', 'customer')) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', `A booking in ${booking.status} cannot be cancelled`);
    }

    const policy = await bookingSettings.getCancellationPolicy();
    const paidRecord = await bookingsRepository.findPaidPayment(bookingId).catch(() => null);
    const paidAmount = paidRecord ? paidRecord.amount : 0;
    const slotStart = bookingSlotStart(booking as never);
    const now = new Date();
    const quote = computeCancellation({ slotStart, now, paidAmount, policy });

    const historyEntry: StatusHistoryEntry = {
      from: booking.status as BookingStatus,
      to: 'cancelled_by_customer',
      at: now,
      actorId: customerId,
      actorRole: 'customer',
      reason,
    };

    const cancelled = await bookingsRepository.markCancelled(
      bookingId,
      customerId,
      booking.status as BookingStatus,
      historyEntry,
      reason,
    );

    if (!cancelled) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', 'The booking was updated concurrently; please refresh and try again');
    }

    let refundStatus: CancellationSummary['refundStatus'] = 'none';
    if (quote.refundAmount > 0 && paidRecord) {
      let refund: unknown;
      try {
        refund = await bookingsRepository.createRefundRequest({
          payment: paidRecord,
          bookingId,
          customerId,
          amount: quote.refundAmount,
          reason,
          now,
        } as any);
        refundStatus = 'requested';
      } catch {
        throw new AppError(
          500,
          'REFUND_REQUEST_FAILED',
          'Your booking is cancelled, but we could not file the refund request. Please contact support.',
        );
      }

      // Admin alert is fire-and-forget: it must never fail the cancellation or the refund request.
      try {
        void Promise.resolve(
          alertRefundRequested({
            refundId: String((refund as { _id?: unknown } | null)?._id ?? ''),
            bookingId,
            amount: quote.refundAmount,
          }),
        ).catch(() => undefined);
      } catch {
        /* ignore */
      }
    }

    const updatedBooking = await BookingService.getBooking(customerId, bookingId);
    const hoursUntilSlot = Math.max(0, Math.round((slotStart.getTime() - now.getTime()) / 3_600_000));

    return {
      booking: updatedBooking,
      cancellation: {
        ...quote,
        hoursUntilSlot,
        refundMethod: quote.refundAmount > 0 && paidRecord ? ('RAZORPAY' as const) : null,
        refundStatus,
      },
    };
  },

  /**
   * Moves the customer's booking to another date and slot. The new slot is re-checked while holding the
   * same lock createBooking uses, so two customers can't take its last seat, then the booking is updated
   * and a history entry is written. 404 for someone else's booking, 409 when the status doesn't allow it
   * or the slot is gone.
   */
  async rescheduleBooking(customerId: string, bookingId: string, input: { date: string; slot: string }) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }

    if (!RESCHEDULABLE_STATUSES.includes(booking.status as BookingStatus)) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', `A booking can't be rescheduled while it is ${booking.status}`);
    }

    const serviceId = String((booking as any).serviceId?._id ?? (booking as any).serviceId);
    if (!serviceId || !booking.date || !booking.slot) {
      throw new AppError(409, 'BOOKING_NOT_RESCHEDULABLE', 'This booking has no slot that can be changed');
    }

    if (hasSlotStarted(booking.date, booking.slot)) {
      throw new AppError(409, 'BOOKING_NOT_RESCHEDULABLE', 'This booking has already started');
    }

    if (booking.date === input.date && booking.slot === input.slot) {
      throw new AppError(400, 'SAME_SLOT', 'Pick a different date or time slot');
    }

    assertBookableDate(input.date);
    if (hasSlotStarted(input.date, input.slot)) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
    }

    const capacity = await bookingSettings.getSlotCapacity(serviceId);
    const now = new Date();
    const fromDate = booking.date;
    const fromSlot = booking.slot;
    const fromStatus = booking.status as BookingStatus;

    try {
      return await withSlotLock(`booking:${serviceId}:${input.date}:${input.slot}`, async () => {
        await bookingsRepository.releaseStaleHolds(serviceId, input.date, input.slot, now);
        const seat = await bookingsRepository.findFreeSeat(serviceId, input.date, input.slot, capacity, now);
        if (seat === null) {
          throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
        }

        const historyEntry: StatusHistoryEntry = {
          from: fromStatus,
          to: fromStatus,
          at: now,
          actorId: customerId,
          actorRole: 'customer',
          reason: `Rescheduled from ${fromDate} (${fromSlot}) to ${input.date} (${input.slot})`,
        };

        const updated = await bookingsRepository.reschedule({
          bookingId,
          customerId,
          fromStatus,
          fromDate,
          fromSlot,
          to: {
            date: input.date,
            slot: input.slot,
            seat,
            scheduledAt: slotStartDate(input.date, input.slot),
          },
          entry: historyEntry,
        } as any);

        if (!updated) {
          throw new AppError(409, 'INVALID_STATE_TRANSITION', 'The booking was updated concurrently; please refresh and try again');
        }

        return BookingService.getBooking(customerId, bookingId);
      });
    } catch (err) {
      if (isDuplicateKey(err, 'uniq_active_slot_seat')) {
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
      }
      throw err;
    }
  },

  async listBookings(customerId: string, query: ListBookingsQuery) {
    const { items, total } = await bookingsRepository.listPageForCustomer(customerId, query);
    return {
      items: items.map((b) => toView(b as never)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  },
};