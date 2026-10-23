import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import { addressesService, type ResolvedAddress } from '../addresses/addresses.service';
import { bookingsRepository } from './bookings.repository';
import type { ListBookingsQuery } from './bookings.query';
import { bookingSettings } from './bookings.settings';
import { withSlotLock } from './bookings.lock';
import {
  BOOKING_HOLD_MS,
  BOOKING_STATUS,
  BOOKING_WINDOW_DAYS,
  PRICE_CHANGED_TOLERANCE,
  SERVICE_SLOTS,
  START_OTP_STATUS,
  type BookingStatus,
} from './bookings.constants';
import type { CreateBookingInput, PriceLine, PriceSnapshot } from './bookings.types';
import { addDays, isRealDate, nowInBookingTz, slotStartMinutes } from './bookings.time';
import { BOOKING_PAYMENT_STATUS } from '../../models/Booking';
import { ServiceModel } from '../../models/Service';
import { calculatePricing } from '../pricing/pricing.service';
import { canTransition } from './bookings.stateMachine';
import { computeCancellation } from './bookings.cancel';
import { buildDetailView } from './bookings.detail';
import { buildInvoiceData, renderInvoiceHtml } from './bookings.invoice';

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

function hasSlotStarted(date: string, slot: string): boolean {
  const now = nowInBookingTz();
  return date === now.date && slotStartMinutes(slot) <= now.minutes;
}

function toView(doc: { toObject?: () => Record<string, unknown> } | Record<string, unknown>): Record<string, unknown> {
  const obj =
    typeof (doc as { toObject?: unknown }).toObject === 'function'
      ? (doc as { toObject: () => Record<string, unknown> }).toObject()
      : { ...(doc as Record<string, unknown>) };
 const rest = { ...obj };
for (const key of ['requestHash', 'idempotencyKey', 'slotSeat', '__v', 'otp']) delete rest[key];
  return rest;
}

/** "2026-10-01" + "10:00-12:00" -> the slot start instant in Asia/Kolkata. */
function slotStartDate(date: string, slot: string): Date {
  return new Date(`${date}T${slot.slice(0, 5)}:00+05:30`);
}

function plainBooking(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && 'toObject' in value && typeof value.toObject === 'function') {
    return value.toObject() as Record<string, unknown>;
  }
  return { ...(value as Record<string, unknown>) };
}

function isDuplicateKey(err: unknown, indexName: string): boolean {
  const e = err as { code?: number; message?: string };
  return e?.code === 11000 && String(e.message ?? '').includes(indexName);
}

function assertCustomerCanCancel(status: BookingStatus): void {
  if (!canTransition(status, BOOKING_STATUS.CANCELLED_BY_CUSTOMER, 'customer')) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION', `Cannot cancel a booking in ${status} status`);
  }
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
      })
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

    const row = await ServiceModel.findOne(
      { _id: input.serviceId, active: { $ne: false } },
      'name basePrice addOns',
    ).lean();
    if (!row) throw new AppError(404, 'SERVICE_NOT_FOUND', 'That service was not found');
    const service = {
      id: String(row._id), name: row.name, basePrice: row.basePrice,
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

    if (input.couponCode) {
      throw new AppError(422, 'COUPON_INVALID', 'Coupons are not available yet. Remove the code to continue.');
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
    const pricing = calculatePricing({ lines, slot: input.slot });
    const priceSnapshot: PriceSnapshot = {
      currency: 'INR',
      lines,
      ...pricing,
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
        return bookingsRepository.create({
          customerId: new Types.ObjectId(customerId),
          serviceId: new Types.ObjectId(input.serviceId),
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
      });
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

  async getBooking(customerId: string, bookingId: string) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    const raw = plainBooking(booking);
    const startOtp =
      raw.status === START_OTP_STATUS
        ? await bookingsRepository.getOrCreateStartOtp(bookingId)
        : null;
    return buildDetailView(raw, startOtp);
  },

  async listBookings(customerId: string, query: ListBookingsQuery) {
    const { items, total } = await bookingsRepository.listPageForCustomer(customerId, query);
    return {
      items: items.map((b) => toView(b as never)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  },

  async decideExtraCharge(
    customerId: string,
    bookingId: string,
    chargeId: string,
    decision: 'approve' | 'reject',
  ) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const raw = plainBooking(booking);
    const charges = Array.isArray(raw.extraCharges) ? raw.extraCharges as Record<string, unknown>[] : [];
    if (raw.status !== 'in_progress') {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', 'Extra charges can only be decided while a job is in progress');
    }
    const charge = charges.find((item) => String(item._id) === chargeId);
    if (!charge) throw new AppError(404, 'EXTRA_CHARGE_NOT_FOUND', 'Extra charge not found');
    const desiredStatus = decision === 'approve' ? 'approved' : 'rejected';
    if (charge.status === desiredStatus) return buildDetailView(raw, null);
    if (charge.status !== 'pending') {
      throw new AppError(409, 'EXTRA_CHARGE_ALREADY_DECIDED', 'This extra charge has already been decided');
    }
    const updated = await bookingsRepository.decideExtraCharge(
      bookingId,
      customerId,
      chargeId,
      desiredStatus,
    );
    if (!updated) throw new AppError(409, 'EXTRA_CHARGE_ALREADY_DECIDED', 'This extra charge has already been decided');
    const refreshed = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!refreshed) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    return buildDetailView(plainBooking(refreshed), null);
  },

  async getInvoice(customerId: string, bookingId: string) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const raw = plainBooking(booking);
    const payment = await bookingsRepository.findPaidPayment(bookingId);
    if (String(payment?.status ?? raw.paymentStatus).toUpperCase() !== 'PAID') {
      throw new AppError(409, 'INVOICE_NOT_AVAILABLE', 'The invoice is available after payment.');
    }
    const customer = await bookingsRepository.findCustomerContact(customerId);
    const view = {
      ...raw,
      paymentStatus: 'PAID',
      paymentDetails: {
        ...(typeof raw.paymentDetails === 'object' && raw.paymentDetails ? raw.paymentDetails : {}),
        method: payment?.method,
        paymentId: payment?.razorpayPaymentId,
        paidAt: payment?.paidAt,
      },
    };
    const data = buildInvoiceData(
      view,
      customer
        ? { name: customer.name, email: customer.email, phone: customer.phone ?? undefined }
        : {},
    );
    return { invoiceNo: data.invoiceNo, html: renderInvoiceHtml(data) };
  },

  async previewCancellation(customerId: string, bookingId: string) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    assertCustomerCanCancel(booking.status);
    const [policy, payment] = await Promise.all([
      bookingSettings.getCancellationPolicy(),
      bookingsRepository.findPaidPayment(bookingId),
    ]);
    const quote = computeCancellation({
      slotStart: booking.scheduledAt,
      now: new Date(),
      paidAmount: payment?.status === 'PAID' ? payment.amount : 0,
      policy,
    });
    return {
      ...quote,
      refundAmount: quote.refundAmount,
      freeCancellation: quote.freeCancellation,
    };
  },

  async cancelBooking(customerId: string, bookingId: string, reason: string) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    assertCustomerCanCancel(booking.status);
    const [policy, payment] = await Promise.all([
      bookingSettings.getCancellationPolicy(),
      bookingsRepository.findPaidPayment(bookingId),
    ]);
    const quote = computeCancellation({
      slotStart: booking.scheduledAt,
      now: new Date(),
      paidAmount: payment?.status === 'PAID' ? payment.amount : 0,
      policy,
    });
    const entry = {
      from: booking.status,
      to: BOOKING_STATUS.CANCELLED_BY_CUSTOMER,
      at: new Date(),
      actorId: customerId,
      actorRole: 'customer' as const,
      reason,
    };
    const updated = await bookingsRepository.markCancelled(
      bookingId,
      customerId,
      booking.status,
      entry,
      reason,
    );
    if (!updated) throw new AppError(409, 'INVALID_STATE_TRANSITION', 'The booking changed. Refresh and try again.');

    let refundStatus: 'requested' | 'none' = 'none';
    if (payment?.status === 'PAID' && quote.refundAmount > 0) {
      await bookingsRepository.createRefundRequest({
        bookingId,
        customerId,
        paymentId: String(payment._id),
        amount: quote.refundAmount,
        reason: `Booking cancellation: ${reason}`,
      });
      refundStatus = 'requested';
    }
    return {
      booking: toView(updated as never),
      cancellation: {
        fee: quote.fee,
        refundAmount: quote.refundAmount,
        refundStatus,
      },
    };
  },

  async rescheduleBooking(
    customerId: string,
    bookingId: string,
    target: { date: string; slot: string },
  ) {
    const booking = await bookingsRepository.findByIdForCustomer(bookingId, customerId);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    if (!['created', 'pending_payment', 'confirmed', 'searching_for_partner'].includes(booking.status)) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', 'This booking can no longer be rescheduled.');
    }
    if (booking.date === target.date && booking.slot === target.slot) {
      throw new AppError(400, 'SAME_SLOT', 'Choose a different date or time slot.');
    }
    assertBookableDate(target.date);
    if (!(SERVICE_SLOTS as readonly string[]).includes(target.slot)) {
      throw new AppError(400, 'INVALID_SLOT', 'Choose a valid service time slot.');
    }
    const serviceId = String(booking.serviceId);
    const capacity = await bookingSettings.getSlotCapacity(serviceId);
    const moved = await withSlotLock(
      `booking:${serviceId}:${target.date}:${target.slot}`,
      async () => {
        await bookingsRepository.releaseStaleHolds(serviceId, target.date, target.slot);
        const seat = await bookingsRepository.findFreeSeat(serviceId, target.date, target.slot, capacity);
        if (seat === null) throw new AppError(409, 'SLOT_UNAVAILABLE', 'Selected slot is no longer available');
        const entry = {
          from: booking.status,
          to: booking.status,
          at: new Date(),
          actorId: customerId,
          actorRole: 'customer' as const,
          reason: `Rescheduled from ${booking.date} ${booking.slot}`,
        };
        return bookingsRepository.reschedule({
          bookingId,
          customerId,
          fromStatus: booking.status,
          to: { date: target.date, slot: target.slot, seat },
          entry,
          scheduledAt: slotStartDate(target.date, target.slot),
        });
      },
    );
    if (!moved) throw new AppError(409, 'INVALID_STATE_TRANSITION', 'The booking changed. Refresh and try again.');
    return toView(moved as never);
  },
};