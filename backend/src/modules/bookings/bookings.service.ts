import { createHash } from "crypto";
import { Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import { ServiceModel } from "../../models/Service";

import {
  BOOKING_HOLD_MS,
  BOOKING_STATUS,
  BOOKING_WINDOW_DAYS,
  PRICE_CHANGED_TOLERANCE,
  SERVICE_SLOTS,
  type BookingStatus,
} from "./bookings.constants";

import { bookingsRepository } from "./bookings.repository";

import {
  addDays,
  hasSlotStarted,
  nowInBookingTz,
  slotStartMinutes,
} from "./bookings.time";

import type {
  AddressSnapshot,
  CreateBookingInput,
  PriceSnapshot,
} from "./bookings.types";

import {
  listBookingsQuerySchema,
  type ListBookingsQuery,
} from "./bookings.query";

import { bookingSettings } from "./bookings.settings";
import { withSlotLock } from "./bookings.lock";
import { addressesService } from "../addresses/addresses.service";
import { pricingService } from "../pricing/pricing.service";
import { couponsService } from "../coupons/coupons.service";
import { notifyAdmins } from "../notifications/notifications.service";

import {
  buildInvoiceData,
  renderInvoiceHtml,
} from "./bookings.invoice";

import { computeCancellation } from "./bookings.cancel";

const asId = (value: unknown): string => String(value ?? "");

const objectId = (
  value: string,
  field = "id",
): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(400, "INVALID_ID", `Invalid ${field}`);
  }

  return new Types.ObjectId(value);
};

const fail = (
  status: number,
  code: string,
  message: string,
): never => {
  throw new AppError(status, code, message);
};

const hashRequest = (input: CreateBookingInput): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        serviceId: input.serviceId,
        quantity: input.quantity,
        addOns: [...input.addOns].sort((a, b) =>
          a.addOnId.localeCompare(b.addOnId),
        ),
        addressId: input.addressId,
        newAddress: input.newAddress,
        date: input.date,
        slot: input.slot,
        couponCode: input.couponCode?.trim().toUpperCase(),
        expectedTotal: input.expectedTotal,
      }),
    )
    .digest("hex");

const slotStartDate = (date: string, slot: string): Date => {
  const minutes = slotStartMinutes(slot);

  if (minutes < 0) {
    return fail(
      400,
      "INVALID_SLOT",
      "The selected slot is invalid",
    );
  }

  const [year, month, day] = date.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const validCalendarDate =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 2000 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31;

  if (!validCalendarDate) {
    return fail(
      400,
      "INVALID_DATE",
      "The booking date is invalid",
    );
  }

  // Booking times are interpreted in India Standard Time.
  const result = new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(
      minute,
    ).padStart(2, "0")}:00+05:30`,
  );

  if (!Number.isFinite(result.getTime())) {
    return fail(
      400,
      "INVALID_DATE",
      "The booking date is invalid",
    );
  }

  return result;
};

const assertValidDateAndSlot = (
  date: string,
  slot: string,
): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail(
      400,
      "INVALID_DATE",
      "Date must use YYYY-MM-DD format",
    );
  }

  const [year, month, day] = date.split("-").map(Number);
  const calendarDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return fail(
      400,
      "INVALID_DATE",
      "The booking date is invalid",
    );
  }

  if (!(SERVICE_SLOTS as readonly string[]).includes(slot)) {
    return fail(
      400,
      "INVALID_SLOT",
      "The selected slot is invalid",
    );
  }

  const today = nowInBookingTz().date;
  const lastDate = addDays(today, BOOKING_WINDOW_DAYS - 1);

  if (date < today || date > lastDate) {
    return fail(
      400,
      "BOOKING_WINDOW_EXCEEDED",
      `Bookings must be made within ${BOOKING_WINDOW_DAYS} days`,
    );
  }

  if (hasSlotStarted(date, slot, new Date())) {
    return fail(
      409,
      "SLOT_STARTED",
      "The selected slot has already started",
    );
  }
};

const toPriceSnapshot = (
  pricing: {
    lines: PriceSnapshot["lines"];
    addOnsTotal: number;
    surge: number;
    surgeLabel?: string;
    subtotal: number;
    discount: number;
    couponCode?: string;
    convenienceFee: number;
    gst: number;
    total: number;
  },
): PriceSnapshot => ({
  currency: "INR",
  lines: pricing.lines,
  addOnsTotal: pricing.addOnsTotal,
  surge: pricing.surge,
  surgeLabel: pricing.surgeLabel,
  subtotal: pricing.subtotal,
  discount: pricing.discount,
  couponCode: pricing.couponCode,
  convenienceFee: pricing.convenienceFee,
  gst: pricing.gst,
  total: pricing.total,
  computedAt: new Date(),
});

export class BookingService {
  static async getAvailableSlots(
    serviceId: string,
    date: string,
  ) {
    objectId(serviceId, "serviceId");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(
        400,
        "INVALID_DATE",
        "Date must use YYYY-MM-DD format",
      );
    }

    const service = await ServiceModel.findById(serviceId).lean();

    if (!service) {
      return fail(
        404,
        "SERVICE_NOT_FOUND",
        "Service not found",
      );
    }

    const now = new Date();
    const capacity =
      await bookingSettings.getSlotCapacity(serviceId);

    await bookingsRepository.releaseStaleHolds(
      serviceId,
      date,
      undefined,
      now,
    );

    const slots = await Promise.all(
      SERVICE_SLOTS.map(async (slot) => {
        const booked =
          await bookingsRepository.countActiveForSlot(
            serviceId,
            date,
            slot,
            now,
          );

        const started = hasSlotStarted(date, slot, now);
        const remaining = Math.max(0, capacity - booked);

        return {
          slot,
          available: !started && remaining > 0,
          capacity,
          booked,
          remaining,
        };
      }),
    );

    return { serviceId, date, slots };
  }

  static async checkSlotAvailability(
    serviceId: string,
    date: string,
    slot: string,
  ) {
    assertValidDateAndSlot(date, slot);

    const result = await this.getAvailableSlots(
      serviceId,
      date,
    );

    const selected = result.slots.find(
      (item) => item.slot === slot,
    );

    if (!selected) {
      return fail(
        404,
        "SLOT_NOT_FOUND",
        "The selected slot was not found",
      );
    }

    return selected;
  }

  static async createBooking(
    customerId: string,
    input: CreateBookingInput,
    idempotencyKey?: string,
  ) {
    objectId(customerId, "customerId");
    objectId(input.serviceId, "serviceId");

    assertValidDateAndSlot(input.date, input.slot);

    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      return fail(
        400,
        "INVALID_QUANTITY",
        "Quantity must be at least 1",
      );
    }

    if (
      input.addOns.some(
        (item) =>
          !Types.ObjectId.isValid(item.addOnId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      )
    ) {
      return fail(
        400,
        "INVALID_ADD_ON",
        "One or more add-ons are invalid",
      );
    }

    if (Boolean(input.addressId) === Boolean(input.newAddress)) {
      return fail(
        400,
        "INVALID_ADDRESS",
        "Provide exactly one of addressId or newAddress",
      );
    }

    const requestHash = hashRequest(input);

    if (idempotencyKey) {
      const existing =
        await bookingsRepository.findByCustomerAndIdempotencyKey(
          customerId,
          idempotencyKey,
        );

      if (existing) {
        if ((existing as any).requestHash !== requestHash) {
          return fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key was already used for a different request",
          );
        }

        return { booking: existing, replayed: true };
      }
    }

    const foundService = await ServiceModel.findById(
      input.serviceId,
    );

    if (!foundService) {
      return fail(
        404,
        "SERVICE_NOT_FOUND",
        "Service not found",
      );
    }

    // The explicit assignment ensures service is non-null below.
    const service = foundService;

    let addressSnapshot: AddressSnapshot;

    if (input.addressId) {
      const resolved = await addressesService.resolveForBooking(
        customerId,
        input.addressId,
      );

      addressSnapshot = resolved as AddressSnapshot;
    } else if (input.newAddress) {
      addressSnapshot = input.newAddress as AddressSnapshot;

      await addressesService.assertServiceable(
        addressSnapshot.pincode,
      );
    } else {
      return fail(
        400,
        "INVALID_ADDRESS",
        "A booking address is required",
      );
    }

    const pricing = await pricingService.quote(
      {
        serviceId: input.serviceId,
        quantity: input.quantity,
        addOns: input.addOns,
        date: input.date,
        slot: input.slot,
        couponCode: input.couponCode,
      } as any,
      customerId,
    );

    const priceSnapshot = toPriceSnapshot(pricing as any);

    if (
      input.expectedTotal !== undefined &&
      Math.abs(input.expectedTotal - priceSnapshot.total) >
        PRICE_CHANGED_TOLERANCE
    ) {
      return fail(
        409,
        "PRICE_CHANGED",
        "The booking price has changed. Please review the updated total.",
      );
    }

    const requirePayment =
      await bookingSettings.isPaymentRequired();

    const initialStatus: BookingStatus = requirePayment
      ? BOOKING_STATUS.PENDING_PAYMENT
      : BOOKING_STATUS.CONFIRMED;

    const initialPaymentStatus = requirePayment
      ? "pending"
      : "not_required";

    const capacity =
      await bookingSettings.getSlotCapacity(input.serviceId);

    const lines = priceSnapshot.lines;

    if (!lines.length) {
      return fail(
        500,
        "PRICE_CALCULATION_FAILED",
        "No booking price lines were returned",
      );
    }

    const now = new Date();

    const created = await withSlotLock(
      `booking:${input.serviceId}:${input.date}:${input.slot}`,
      async () => {
        await bookingsRepository.releaseStaleHolds(
          input.serviceId,
          input.date,
          input.slot,
          now,
        );

        const seat = await bookingsRepository.findFreeSeat(
          input.serviceId,
          input.date,
          input.slot,
          capacity,
          now,
        );

        // Handles both null and undefined seat results.
        if (seat == null) {
          return fail(
            409,
            "SLOT_UNAVAILABLE",
            "Selected slot is no longer available",
          );
        }

        const booking = await bookingsRepository.create({
          customerId: objectId(customerId),
          serviceId: objectId(input.serviceId),
          ...(service.categoryId
            ? { categoryId: service.categoryId }
            : {}),
          quantity: input.quantity,
          addOns: input.addOns.map((item) => ({
            addOnId: objectId(item.addOnId, "addOnId"),
            quantity: item.quantity,
          })),
          addressSnapshot: {
            ...addressSnapshot,
            sourceAddressId: addressSnapshot.sourceAddressId
              ? objectId(
                  addressSnapshot.sourceAddressId,
                  "addressId",
                )
              : undefined,
          },
          serviceName: service.name,
          address: {
            line1: addressSnapshot.line1,
            area: addressSnapshot.line2,
            city: addressSnapshot.city,
            pincode: addressSnapshot.pincode,
            ...(addressSnapshot.location
              ? {
                  location: {
                    type: "Point",
                    coordinates: [
                      addressSnapshot.location.lng,
                      addressSnapshot.location.lat,
                    ],
                  },
                }
              : {}),
          },
          scheduledAt: slotStartDate(input.date, input.slot),
          priceBreakdown: {
            base: lines[0].amount,
            addOns: priceSnapshot.addOnsTotal,
            surge: priceSnapshot.surge,
            discount: priceSnapshot.discount,
            convenienceFee: priceSnapshot.convenienceFee,
            tax: priceSnapshot.gst,
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
              actorRole: "customer",
              note: requirePayment
                ? "Booking created, awaiting payment"
                : "Booking confirmed",
            },
          ],
          slotSeat: seat,
          idempotencyKey,
          requestHash,
          holdExpiresAt: requirePayment
            ? new Date(now.getTime() + BOOKING_HOLD_MS)
            : undefined,
        } as any);

        if (input.couponCode) {
          await couponsService.recordUsage(
            input.couponCode.trim().toUpperCase(),
            customerId,
            asId((booking as any)._id),
          );
        }

        return booking;
      },
    );

    void Promise.resolve(
      notifyAdmins("booking.created", {
        bookingId: asId((created as any)._id),
        serviceId: input.serviceId,
      }),
    ).catch(() => undefined);

    return { booking: created, replayed: false };
  }

  static async getBooking(
    customerId: string,
    bookingId: string,
  ) {
    objectId(customerId, "customerId");
    objectId(bookingId, "bookingId");

    const booking =
      await bookingsRepository.findByIdForCustomer(
        bookingId,
        customerId,
      );

    if (!booking) {
      return fail(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found",
      );
    }

    return booking;
  }

  static async getInvoice(
    customerId: string,
    bookingId: string,
  ) {
    const booking = await this.getBooking(
      customerId,
      bookingId,
    );

    if (
      !["completed", "rated"].includes(
        String((booking as any).status),
      )
    ) {
      return fail(
        409,
        "INVOICE_NOT_AVAILABLE",
        "The invoice is not available for this booking yet",
      );
    }

    const contact =
      await bookingsRepository.findCustomerContact(customerId);

    const paidPayment =
      await bookingsRepository.findPaidPayment(bookingId);

    const rawBooking =
      typeof (booking as any).toObject === "function"
        ? (booking as any).toObject()
        : booking;

    const view = {
      ...(rawBooking as any),
      paymentDetails: paidPayment,
    };

    const invoice = buildInvoiceData(
      view,
      contact as any,
    );

    return renderInvoiceHtml(invoice);
  }

  static async decideExtraCharge(
    customerId: string,
    bookingId: string,
    chargeId: string,
    decision: "approve" | "reject",
  ) {
    objectId(customerId, "customerId");
    objectId(bookingId, "bookingId");
    objectId(chargeId, "chargeId");

    const booking =
      await bookingsRepository.findByIdForCustomer(
        bookingId,
        customerId,
      );

    if (!booking) {
      return fail(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found",
      );
    }

    if (
      !["arrived", "in_progress"].includes(
        String((booking as any).status),
      )
    ) {
      return fail(
        409,
        "INVALID_BOOKING_STATUS",
        "Extra charges can only be decided during service",
      );
    }

    const updated =
      await bookingsRepository.decideExtraCharge(
        bookingId,
        customerId,
        chargeId,
        decision === "approve" ? "approved" : "rejected",
      );

    if (!updated) {
      return fail(
        404,
        "EXTRA_CHARGE_NOT_FOUND",
        "Extra charge not found",
      );
    }

    return updated;
  }

  static async previewCancellation(
    customerId: string,
    bookingId: string,
  ) {
    const booking = await this.getBooking(
      customerId,
      bookingId,
    );

    const policy =
      await bookingSettings.getCancellationPolicy();

    const status = String((booking as any).status);

    const cancellable = [
      "pending_payment",
      "confirmed",
      "created",
      "searching_for_partner",
      "assigned",
      "en_route",
      "arrived",
    ].includes(status);

    const paidPayment =
      await bookingsRepository.findPaidPayment(bookingId);

    const paidAmount = Number(
      (paidPayment as any)?.amount ??
        (booking as any).priceSnapshot?.total ??
        0,
    );

    const scheduledAt = new Date(
      (booking as any).scheduledAt,
    );

    const quote = computeCancellation({
      slotStart: scheduledAt,
      now: new Date(),
      paidAmount,
      policy,
    });

    return {
      bookingId,
      cancellable,
      hoursUntilStart:
        (scheduledAt.getTime() - Date.now()) /
        (60 * 60 * 1000),
      cancellationWindowHours: policy.windowHours,
      freeCancellation: quote.freeCancellation,
      fee: quote.fee,
      cancellationFee: quote.fee,
      refundAmount: quote.refundAmount,
    };
  }

  static async previewCancel(
    customerId: string,
    bookingId: string,
  ) {
    return this.previewCancellation(
      customerId,
      bookingId,
    );
  }

  static async cancelBooking(
    customerId: string,
    bookingId: string,
    reason?: string,
  ) {
    const booking = await this.getBooking(
      customerId,
      bookingId,
    );

    const fromStatus = (booking as any).status as BookingStatus;

    const preview = await this.previewCancellation(
      customerId,
      bookingId,
    );

    if (!preview.cancellable) {
      return fail(
        409,
        "BOOKING_NOT_CANCELLABLE",
        "This booking cannot be cancelled in its current state",
      );
    }

    const now = new Date();

    const saved = await bookingsRepository.markCancelled(
      bookingId,
      customerId,
      fromStatus,
      {
        from: fromStatus,
        to: BOOKING_STATUS.CANCELLED_BY_CUSTOMER,
        at: now,
        actorId: customerId,
        actorRole: "customer",
        note: reason ?? "Cancelled by customer",
      } as any,
      reason,
    );

    if (!saved) {
      return fail(
        409,
        "CANCELLATION_FAILED",
        "Could not cancel this booking",
      );
    }

    let refund = null;

    if (preview.refundAmount > 0) {
      const payment =
        await bookingsRepository.findPaidPayment(bookingId);

      if (payment) {
        refund = await bookingsRepository.createRefundRequest({
          payment,
          bookingId,
          customerId,
          amount: preview.refundAmount,
          reason: reason ?? "Customer booking cancellation",
          now,
        });
      }
    }

    return {
      booking: saved,
      cancellation: {
        fee: preview.fee,
        refundAmount: preview.refundAmount,
        refundStatus: refund ? "requested" : "not_required",
      },
      cancellationFee: preview.fee,
      refundAmount: preview.refundAmount,
    };
  }

  static async rescheduleBooking(
    customerId: string,
    bookingId: string,
    input: { date: string; slot: string },
  ) {
    objectId(customerId, "customerId");
    objectId(bookingId, "bookingId");

    assertValidDateAndSlot(input.date, input.slot);

    const booking =
      await bookingsRepository.findByIdForCustomer(
        bookingId,
        customerId,
      );

    if (!booking) {
      return fail(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found",
      );
    }

    const fromStatus = (booking as any).status as BookingStatus;

    if (
      !["confirmed", "created", "searching_for_partner"].includes(
        String(fromStatus),
      )
    ) {
      return fail(
        409,
        "BOOKING_NOT_RESCHEDULABLE",
        "This booking cannot be rescheduled in its current state",
      );
    }

    const serviceId = asId((booking as any).serviceId);
    const capacity =
      await bookingSettings.getSlotCapacity(serviceId);

    const result = await withSlotLock(
      `booking:${serviceId}:${input.date}:${input.slot}`,
      async () => {
        await bookingsRepository.releaseStaleHolds(
          serviceId,
          input.date,
          input.slot,
          new Date(),
        );

        const seat = await bookingsRepository.findFreeSeat(
          serviceId,
          input.date,
          input.slot,
          capacity,
          new Date(),
        );

        // Handles both null and undefined seat results.
        if (seat == null) {
          return fail(
            409,
            "SLOT_UNAVAILABLE",
            "Selected slot is no longer available",
          );
        }

        return bookingsRepository.reschedule({
          bookingId,
          customerId,
          to: {
            date: input.date,
            slot: input.slot,
            seat,
            scheduledAt: slotStartDate(
              input.date,
              input.slot,
            ),
          },
          fromStatus,
          fromDate: String((booking as any).date),
          fromSlot: String((booking as any).slot),
          entry: {
            from: fromStatus,
            to: fromStatus,
            at: new Date(),
            actorId: customerId,
            actorRole: "customer",
            note: `Rescheduled to ${input.date}, ${input.slot}`,
          } as any,
        });
      },
    );

    if (!result) {
      return fail(
        409,
        "RESCHEDULE_FAILED",
        "Could not reschedule this booking",
      );
    }

    return result;
  }

  static async listBookings(
    customerId: string,
    query: Record<string, unknown>,
  ) {
    objectId(customerId, "customerId");

    const parsed = listBookingsQuerySchema.safeParse(query);

    if (!parsed.success) {
      return fail(
        400,
        "INVALID_BOOKING_QUERY",
        parsed.error.issues
          .map((issue) => issue.message)
          .join("; "),
      );
    }

    const q: ListBookingsQuery = parsed.data;

    // Ensure sort is always a supported value.
    const normalizedQuery: ListBookingsQuery = {
      ...q,
      sort: q.sort ?? "newest",
    };

    const result =
      await bookingsRepository.listPageForCustomer(
        customerId,
        normalizedQuery,
        new Date(),
      );

    return {
      items: result.items,
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total: result.total,
        totalPages: Math.ceil(
          result.total / normalizedQuery.limit,
        ),
        sort: normalizedQuery.sort,
      },
    };
  }
}
