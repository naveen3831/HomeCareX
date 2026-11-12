import { createHash } from "crypto";
import mongoose, { Types } from "mongoose";
import { ReferralModel } from "../referrals/referrals.model";
import { notifyAdmins } from "../notifications";
import { alertRefundRequested } from "../notifications/admin-alerts";
import { AppError } from "../../utils/AppError";
import { addressesService, type ResolvedAddress } from "../addresses/addresses.service";
import { bookingsRepository } from "./bookings.repository";
import type { ListBookingsQuery } from "./bookings.query";
import { bookingSettings } from "./bookings.settings";
import { withSlotLock } from "./bookings.lock";
import {
  buildDetailView,
  INTERNAL_KEYS,
  type PaymentInfo,
  type ServiceInfo,
} from "./bookings.detail";
import {
  buildInvoiceData,
  renderInvoiceHtml,
  withPaymentRecord,
} from "./bookings.invoice";
import { PaymentModel } from "../../models/Payment";
import { RefundModel } from "../../models/Refund";
import {
  BOOKING_HOLD_MS,
  BOOKING_STATUS,
  BOOKING_WINDOW_DAYS,
  PRICE_CHANGED_TOLERANCE,
  RESCHEDULABLE_STATUSES,
  SERVICE_SLOTS,
  START_OTP_STATUS,
  type BookingStatus,
} from "./bookings.constants";
import { canTransition, type StatusHistoryEntry } from "./bookings.stateMachine";
import {
  computeCancellation,
  type CancellationQuote,
} from "./bookings.cancel";
import type {
  CreateBookingInput,
  PriceLine,
  PriceSnapshot,
} from "./bookings.types";
import {
  addDays,
  hasSlotStarted,
  isRealDate,
  nowInBookingTz,
} from "./bookings.time";
import { BookingModel, BOOKING_PAYMENT_STATUS } from "../../models/Booking";
import { PAYMENT_MAX_ATTEMPTS } from "../payments/payments.constants";
import { ServiceModel } from "../../models/Service";
import {
  calculatePricing,
  toQuoteCouponCode,
} from "../pricing/pricing.service";
import { couponsService } from "../coupons/coupons.service";
import { referralsService } from "../referrals/referrals.service";
import { HttpError } from "../auth/auth.types";

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
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((key) => obj[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function assertBookableDate(date: string): void {
  const now = nowInBookingTz();
  const lastBookable = addDays(now.date, BOOKING_WINDOW_DAYS - 1);

  if (!isRealDate(date) || date < now.date || date > lastBookable) {
    throw new AppError(
      400,
      "INVALID_DATE",
      `Pick a date between ${now.date} and ${lastBookable}`,
    );
  }
}

/** A mongoose document (or plain object) as a plain object. */
function rawObject(doc: unknown): Record<string, unknown> {
  const value = doc as { toObject?: () => Record<string, unknown> };
  return typeof value?.toObject === "function"
    ? value.toObject()
    : { ...(doc as Record<string, unknown>) };
}

/** Catalog details for the details page. A missing service never breaks the booking. */
async function loadServiceInfo(
  serviceId: unknown,
  serviceName?: unknown,
): Promise<ServiceInfo | null> {
  const hasId = Boolean(serviceId) && Types.ObjectId.isValid(String(serviceId));
  if (!hasId && (typeof serviceName !== "string" || !serviceName.trim())) {
    return null;
  }

  try {
    const query = hasId
      ? ServiceModel.findById(String(serviceId))
      : ServiceModel.findOne({ name: String(serviceName).trim() });

    const service = (await query
      .select("name description durationMinutes media categoryId")
      .populate("categoryId", "name")
      .lean()
      .exec()) as {
      name?: string;
      description?: string;
      durationMinutes?: number;
      media?: Array<{ url?: string }>;
      categoryId?: { name?: string } | null;
    } | null;

    if (!service) return null;

    return {
      name: service.name,
      description: service.description || undefined,
      durationMinutes: service.durationMinutes,
      image: service.media?.[0]?.url || undefined,
      categoryName:
        service.categoryId && typeof service.categoryId === "object"
          ? service.categoryId.name
          : undefined,
    };
  } catch {
    return null;
  }
}

/** The latest payment attempt, preferring a paid one. Best effort. */
async function loadPaymentInfo(bookingId: string): Promise<PaymentInfo | null> {
  try {
    const rows = await PaymentModel.find({
      bookingId: new Types.ObjectId(bookingId),
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .exec();

    const payment = rows.find((row) => row.status === "PAID") ?? rows[0];
    if (!payment) return null;

    return {
      status: payment.status,
      method: payment.method,
      transactionId: payment.razorpayPaymentId,
      paidAt: payment.paidAt,
    };
  } catch {
    return null;
  }
}

/** The latest refund request for the booking. Best effort. */
async function loadRefundInfo(
  bookingId: string,
): Promise<Record<string, unknown> | null> {
  try {
    if (!Types.ObjectId.isValid(bookingId)) return null;

    const refund = await RefundModel.findOne({
      bookingId: new Types.ObjectId(bookingId),
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return refund as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function toView(
  doc:
    | { toObject?: () => Record<string, unknown> }
    | Record<string, unknown>,
): Record<string, unknown> {
  const value = doc as { toObject?: unknown };
  const object =
    typeof value.toObject === "function"
      ? (doc as { toObject: () => Record<string, unknown> }).toObject()
      : { ...(doc as Record<string, unknown>) };

  const result = { ...object };
  for (const key of INTERNAL_KEYS) delete result[key];
  for (const key of ["requestHash", "idempotencyKey", "slotSeat", "__v", "otp"]) {
    delete result[key];
  }
  if (!Array.isArray(result.extraCharges)) result.extraCharges = [];

  return result;
}

/** "2026-10-01" + "10:00-12:00" -> slot start instant in Asia/Kolkata. */
function slotStartDate(date: string, slot: string): Date {
  return new Date(`${date}T${slot.slice(0, 5)}:00+05:30`);
}

function bookingSlotStart(booking: {
  scheduledAt?: Date;
  date?: string;
  slot?: string;
}): Date {
  if (
    booking.scheduledAt instanceof Date &&
    !Number.isNaN(booking.scheduledAt.getTime())
  ) {
    return booking.scheduledAt;
  }

  if (booking.date && booking.slot) {
    const date = slotStartDate(booking.date, booking.slot);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function isDuplicateKey(err: unknown, indexName: string): boolean {
  const error = err as { code?: number; message?: string };
  return (
    error?.code === 11000 &&
    String(error.message ?? "").includes(indexName)
  );
}

export interface CancellationSummary extends CancellationQuote {
  hoursUntilSlot?: number;
  /** Where money goes back, or null when nothing was paid. */
  refundMethod: "WALLET" | "RAZORPAY" | null;
  refundStatus: "requested" | "none";
}

export const BookingService = {
  async getAvailableSlots(
    serviceId: string,
    date: string,
  ): Promise<SlotsResponse> {
    assertBookableDate(date);
    const capacity = await bookingSettings.getSlotCapacity(serviceId);

    const slots = await Promise.all(
      SERVICE_SLOTS.map(async (slot): Promise<SlotAvailability> => {
        if (hasSlotStarted(date, slot)) {
          return { slot, available: false, remaining: 0 };
        }

        const taken = await bookingsRepository.countActiveForSlot(
          serviceId,
          date,
          slot,
        );
        const remaining = Math.max(capacity - taken, 0);

        return { slot, available: remaining > 0, remaining };
      }),
    );

    return { serviceId, date, slots };
  },

  /** Fast real-time slot pre-check before advancing steps or paying. */
  async checkSlotAvailability(
    serviceId: string,
    date: string,
    slot: string,
  ): Promise<SlotAvailability> {
    assertBookableDate(date);

    if (hasSlotStarted(date, slot)) {
      throw new AppError(
        409,
        "SLOT_UNAVAILABLE",
        "Selected slot is no longer available",
      );
    }

    const capacity = await bookingSettings.getSlotCapacity(serviceId);
    const taken = await bookingsRepository.countActiveForSlot(
      serviceId,
      date,
      slot,
    );
    const remaining = Math.max(capacity - taken, 0);

    if (remaining <= 0) {
      throw new AppError(
        409,
        "SLOT_UNAVAILABLE",
        "Selected slot is no longer available",
      );
    }

    return { slot, available: true, remaining };
  },

  async createBooking(
    customerId: string,
    input: CreateBookingInput,
    idempotencyKey: string | undefined,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "An Idempotency-Key header is required to create a booking",
      );
    }

    const requestHash = createHash("sha256")
      .update(stableStringify(input))
      .digest("hex");

    const replay = async () => {
      const existing =
        await bookingsRepository.findByCustomerAndIdempotencyKey(
          customerId,
          idempotencyKey,
        );

      if (!existing) return null;

      if (existing.requestHash !== requestHash) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This Idempotency-Key was already used with a different request",
        );
      }

      return { booking: toView(existing as never), replayed: true };
    };

    const replayed = await replay();
    if (replayed) {
      if (
        replayed.booking.paymentStatus === "FAILED" ||
        (replayed.booking as { paymentDetails?: { status?: string } }).paymentDetails?.status === "FAILED"
      ) {
        throw new AppError(
          429,
          "PAYMENT_RETRY_LIMIT_EXCEEDED",
          "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
        );
      }
      return replayed;
    }

    const row = await ServiceModel.findOne(
      { _id: input.serviceId, active: { $ne: false } },
      "name basePrice addOns categoryId",
    ).lean();

    if (!row) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "That service was not found");
    }

    const service = {
      id: String(row._id),
      name: row.name,
      basePrice: row.basePrice,
      categoryId: (row as { categoryId?: Types.ObjectId }).categoryId,
      addOns: (row.addOns ?? []).map((addon) => ({
        id: String(addon._id),
        name: addon.name,
        price: addon.price,
      })),
    };

    const addOnLines: PriceLine[] = input.addOns.map((selectedAddon) => {
      const addon = service.addOns.find(
        (item) => item.id === selectedAddon.addOnId,
      );

      if (!addon) {
        throw new AppError(
          422,
          "ADDON_NOT_FOUND",
          "One of the selected add-ons is not available for this service",
          { addOnId: selectedAddon.addOnId },
        );
      }

      return {
        kind: "ADDON",
        refId: new Types.ObjectId(addon.id),
        name: addon.name,
        unitPrice: addon.price,
        quantity: selectedAddon.quantity,
        amount: addon.price * selectedAddon.quantity,
      };
    });

    if (
      new Set(input.addOns.map((addon) => addon.addOnId)).size !==
      input.addOns.length
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Each add-on can only be listed once",
      );
    }

    assertBookableDate(input.date);
    if (hasSlotStarted(input.date, input.slot)) {
      throw new AppError(
        409,
        "SLOT_UNAVAILABLE",
        "Selected slot is no longer available",
      );
    }

    let addressSnapshot: ResolvedAddress;
    if (input.addressId) {
      addressSnapshot = await addressesService.resolveForBooking(
        customerId,
        input.addressId,
      );
    } else if (input.newAddress) {
      await addressesService.assertServiceable(input.newAddress.pincode);
      addressSnapshot = { ...input.newAddress };
    } else {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Provide exactly one of addressId or newAddress",
      );
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
      } catch (error) {
        if (error instanceof HttpError) {
          throw new AppError(
            422,
            toQuoteCouponCode(error.code ?? "COUPON_INVALID"),
            error.message,
          );
        }
        throw error;
      }
    }

    const lines: PriceLine[] = [
      {
        kind: "BASE",
        refId: new Types.ObjectId(service.id),
        name: service.name,
        unitPrice: service.basePrice,
        quantity: input.quantity,
        amount: service.basePrice * input.quantity,
      },
      ...addOnLines,
    ];

    // Referred customer's first booking: discount if applicable.
    let referral: { programId: string; discount: number } | null = null;
    let walletUsed = 0;
    const orderValue = lines.reduce((sum, l) => sum + l.amount, 0);

    const offer = await referralsService.refereeDiscount(
      customerId,
      input.serviceId,
      orderValue,
    ).catch(() => null);
    if (offer) {
      const discount = Math.max(
        0,
        Math.min(offer.discount, orderValue - (coupon?.discount ?? 0)),
      );
      if (discount > 0) referral = { programId: offer.programId, discount };
    }

    // Use the same calculation as POST /pricing/quote.
    const pricing = calculatePricing({
      lines,
      slot: input.slot,
      discount: (coupon?.discount ?? 0) + (referral?.discount ?? 0),
    });

    const originalTotal = pricing.total;

    // HomeCareX Wallet deduction
    if (input.useWallet || input.useReferralWallet) {
      const { WalletModel } = await import("../../models/Wallet");
      const wallet = await WalletModel.findOne({ userId: customerId });
      const balance = Math.max(0, wallet?.balance ?? 0);
      if (balance <= 0) {
        throw new AppError(
          400,
          "INSUFFICIENT_WALLET_BALANCE",
          "Insufficient wallet balance to apply to booking",
        );
      }
      walletUsed = Math.min(balance, originalTotal);
    }

    const payable = Math.max(0, originalTotal - walletUsed);

    const priceSnapshot: PriceSnapshot = {
      currency: "INR",
      lines,
      ...pricing,
      ...(coupon ? { couponCode: coupon.code } : {}),
      ...(referral
        ? {
            referralDiscount: referral.discount,
            referralProgramId: referral.programId,
          }
        : {}),
      wallet_used: walletUsed,
      walletUsed,
      payable,
      computedAt: new Date(),
    };

    const targetExpected = (input.useWallet || input.useReferralWallet) ? payable : priceSnapshot.total;
    if (
      input.expectedTotal !== undefined &&
      Math.abs(input.expectedTotal - targetExpected) >
        PRICE_CHANGED_TOLERANCE
    ) {
      throw new AppError(
        409,
        "PRICE_CHANGED",
        `The price changed to ₹${targetExpected}. Please review and confirm again.`,
        {
          expectedTotal: input.expectedTotal,
          total: targetExpected,
        },
      );
    }

    const requirePayment = await bookingSettings.isPaymentRequired();
    const capacity = await bookingSettings.getSlotCapacity(input.serviceId);
    const initialStatus = (requirePayment && payable > 0)
      ? BOOKING_STATUS.PENDING_PAYMENT
      : BOOKING_STATUS.CONFIRMED;
    const initialPaymentStatus = (payable === 0)
      ? BOOKING_PAYMENT_STATUS.PAID
      : BOOKING_PAYMENT_STATUS.PENDING;
    const now = new Date();

    try {
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
          );

          if (seat === null) {
            throw new AppError(
              409,
              "SLOT_UNAVAILABLE",
              "Selected slot is no longer available",
            );
          }

          const createdBooking = await bookingsRepository.create({
            customerId: new Types.ObjectId(customerId),
            serviceId: new Types.ObjectId(input.serviceId),
            ...(service.categoryId ? { categoryId: service.categoryId } : {}),
            quantity: input.quantity,
            addOns: input.addOns.map((addon) => ({
              addOnId: new Types.ObjectId(addon.addOnId),
              quantity: addon.quantity,
            })),
            addressSnapshot: {
              ...addressSnapshot,
              sourceAddressId: addressSnapshot.sourceAddressId
                ? new Types.ObjectId(addressSnapshot.sourceAddressId)
                : undefined,
            },
            // Fields read by the partner jobs/dashboard side (P02-P05).
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
            paymentDetails: (payable === 0)
              ? {
                  status: "PAID",
                  method: "wallet",
                  paidAt: now,
                }
              : undefined,
            statusHistory: [
              {
                from: null,
                to: initialStatus,
                at: now,
                actorId: customerId,
                actorRole: "customer",
                reason: (requirePayment && payable > 0)
                  ? "Booking created, awaiting payment"
                  : (payable === 0 && walletUsed > 0)
                    ? "Booking confirmed via HomeCareX Wallet payment"
                    : "Booking confirmed",
              },
            ],
            slotSeat: seat,
            wallet_used: walletUsed,
            walletUsed,
            payable,
            idempotencyKey,
            requestHash,
            holdExpiresAt: (requirePayment && payable > 0)
              ? new Date(now.getTime() + BOOKING_HOLD_MS)
              : undefined,
          } as never);

          if (walletUsed > 0) {
            const session = await mongoose.startSession();
            try {
              await session.withTransaction(
                async () => {
                  const { WalletModel, WalletLedgerModel } = await import("../../models/Wallet");
                  const wallet = await WalletModel.findOne({ userId: customerId }).session(session);
                  if (!wallet || wallet.balance < walletUsed) {
                    throw new AppError(400, "INSUFFICIENT_WALLET_BALANCE", "Insufficient wallet balance");
                  }
                  wallet.balance -= walletUsed;
                  await wallet.save({ session });

                  await WalletLedgerModel.create(
                    [
                      {
                        walletId: wallet._id,
                        userId: customerId,
                        bookingId: (createdBooking as { _id?: unknown })._id,
                        type: "DEBIT",
                        reason: "BOOKING_PAYMENT",
                        amount: walletUsed,
                        balanceAfter: wallet.balance,
                        description: `HomeCareX Wallet deduction for booking ${service.name}`,
                      },
                    ],
                    { session }
                  );

                  await ReferralModel.updateOne(
                    { refereeId: customerId },
                    {
                      $set: {
                        referralUsed: true,
                        usedAt: now,
                        discountBookingId: (createdBooking as { _id?: unknown })._id,
                        discountAmount: walletUsed,
                      },
                    },
                    { session }
                  );
                },
                {
                  readPreference: "primary",
                  readConcern: { level: "local" },
                  writeConcern: { w: "majority" },
                }
              );
            } finally {
              await session.endSession();
            }
          }

          if (coupon) {
            await couponsService.recordUsage(
              coupon.code,
              customerId,
              String((createdBooking as { _id?: unknown })._id ?? ""),
            );
          }

          if (referral) {
            await referralsService
              .recordRefereeDiscount(
                customerId,
                String((createdBooking as { _id?: unknown })._id ?? ""),
                referral.programId,
                referral.discount,
              )
              .catch((error) =>
                console.error("[referrals] Could not record referee discount:", error),
              );
          }

          return createdBooking;
        },
      );

      // Notifications are best effort and cannot change a successful booking.
      void notifyAdmins("booking.created", {
        bookingId: String((created as { _id?: unknown })._id ?? ""),
        serviceId: input.serviceId,
      }).catch(() => undefined);

      return { booking: toView(created as never), replayed: false };
    } catch (error) {
      if (isDuplicateKey(error, "uniq_customer_idem_key")) {
        const raced = await replay();
        if (raced) return raced;
      }

      if (isDuplicateKey(error, "uniq_active_slot_seat")) {
        throw new AppError(
          409,
          "SLOT_UNAVAILABLE",
          "Selected slot is no longer available",
        );
      }

      throw error;
    }
  },

  /**
   * One booking for its owner. A booking that belongs to someone else is indistinguishable
   * from one that does not exist, so ids cannot be probed.
   */
  async getBooking(customerId: string, bookingId: string) {
    let booking = await bookingsRepository.findByIdForCustomer(
      bookingId,
      customerId,
    );

    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
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

      const refreshed = await bookingsRepository.findByIdForCustomer(
        bookingId,
        customerId,
      );
      if (refreshed) booking = refreshed;
    }

    const normalizedStatus = String(booking.status || "").toLowerCase();
    const isArrived =
      normalizedStatus === START_OTP_STATUS ||
      normalizedStatus === "arrived" ||
      booking.status === START_OTP_STATUS;

    const startOtp = isArrived
      ? await bookingsRepository.getOrCreateStartOtp(
          String((booking as { _id?: unknown })._id || bookingId),
        )
      : null;

    const raw = rawObject(booking);
    const [service, payment, refundDoc] = await Promise.all([
      loadServiceInfo(raw.serviceId, raw.serviceName),
      loadPaymentInfo(bookingId),
      loadRefundInfo(bookingId),
    ]);

    return buildDetailView(raw, startOtp, {
      service,
      payment,
      refund: refundDoc as Record<string, unknown> | null,
    });
  },

  /** Approve or reject one pending extra charge, then return the refreshed booking. */
  async decideExtraCharge(
    customerId: string,
    bookingId: string,
    chargeId: string,
    decision: "approve" | "reject",
  ) {
    const next = decision === "approve" ? "approved" : "rejected";
    const updated = await bookingsRepository.decideExtraCharge(
      bookingId,
      customerId,
      chargeId,
      next,
    );

    if (!updated) {
      const booking = await bookingsRepository.findByIdForCustomer(
        bookingId,
        customerId,
      );

      if (!booking) {
        throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
      }

      const charge = (
        booking as {
          extraCharges?: Array<{ _id?: unknown; status?: string }>;
        }
      ).extraCharges?.find((item) => String(item._id) === chargeId);

      if (!charge) {
        throw new AppError(
          404,
          "EXTRA_CHARGE_NOT_FOUND",
          "Extra charge not found",
        );
      }

      if (charge.status !== "pending") {
        throw new AppError(
          409,
          "EXTRA_CHARGE_ALREADY_DECIDED",
          `This extra charge was already ${charge.status}`,
        );
      }

      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        `An extra charge can't be decided while the booking is ${booking.status}`,
      );
    }

    return BookingService.getBooking(customerId, bookingId);
  },

  /**
   * The invoice for one of the customer's own bookings.
   * Returns 409 until the booking is paid.
   */
  async getInvoice(
    customerId: string,
    bookingId: string,
  ): Promise<{ html: string; invoiceNo: string }> {
    const view = await BookingService.getBooking(customerId, bookingId);

    if (view.paymentStatus !== "PAID") {
      throw new AppError(
        409,
        "INVOICE_NOT_AVAILABLE",
        "The invoice is available once the booking is paid",
      );
    }

    const customer =
      (await bookingsRepository.findCustomerContact(customerId)) ?? {};
    const paidRecord = await bookingsRepository
      .findPaidPayment(bookingId)
      .catch(() => null);

    const data = buildInvoiceData(
      withPaymentRecord(view, paidRecord as never),
      customer,
    );

    return { html: renderInvoiceHtml(data), invoiceNo: data.invoiceNo };
  },

  /** Fee and refund summary if the customer cancelled right now. */
  async previewCancellation(
    customerId: string,
    bookingId: string,
  ): Promise<CancellationSummary> {
    const booking = await bookingsRepository.findByIdForCustomer(
      bookingId,
      customerId,
    );

    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    }

    if (
      !canTransition(
        booking.status as BookingStatus,
        "cancelled_by_customer",
        "customer",
      )
    ) {
      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        `A booking in ${booking.status} cannot be cancelled`,
      );
    }

    const policy = await bookingSettings.getCancellationPolicy();
    const paidRecord = await bookingsRepository
      .findPaidPayment(bookingId)
      .catch(() => null);
    const isPaid =
      Boolean(paidRecord && paidRecord.status === "PAID") ||
      booking.paymentStatus === "PAID";
    const paidAmount = paidRecord
      ? paidRecord.amount
      : isPaid
        ? Number(booking.priceBreakdown?.total ?? 0)
        : 0;

    const slotStart = bookingSlotStart(booking as never);
    const now = new Date();
    const quote = computeCancellation({ slotStart, now, paidAmount, policy });
    const hoursUntilSlot = Math.max(
      0,
      Math.round((slotStart.getTime() - now.getTime()) / 3_600_000),
    );

    return {
      ...quote,
      hoursUntilSlot,
      refundMethod:
        quote.refundAmount > 0 && isPaid ? ("WALLET" as const) : null,
      refundStatus:
        quote.refundAmount > 0 && isPaid ? ("requested" as const) : "none",
    };
  },

  async previewCancel(
    customerId: string,
    bookingId: string,
  ): Promise<CancellationSummary> {
    return BookingService.previewCancellation(customerId, bookingId);
  },

  /**
   * Cancels the customer's booking, then files a refund request if needed.
   */
  async cancelBooking(
    customerId: string,
    bookingId: string,
    reason: string,
  ) {
    const booking = await bookingsRepository.findByIdForCustomer(
      bookingId,
      customerId,
    );

    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    }

    if (
      !canTransition(
        booking.status as BookingStatus,
        "cancelled_by_customer",
        "customer",
      )
    ) {
      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        `A booking in ${booking.status} cannot be cancelled`,
      );
    }

    const policy = await bookingSettings.getCancellationPolicy();
    const paidRecord = await bookingsRepository
      .findPaidPayment(bookingId)
      .catch(() => null);
    const isPaid =
      Boolean(paidRecord && paidRecord.status === "PAID") ||
      booking.paymentStatus === "PAID";
    const paidAmount = paidRecord
      ? paidRecord.amount
      : isPaid
        ? Number(booking.priceBreakdown?.total ?? 0)
        : 0;

    const slotStart = bookingSlotStart(booking as never);
    const now = new Date();
    const quote = computeCancellation({ slotStart, now, paidAmount, policy });

    const historyEntry: StatusHistoryEntry = {
      from: booking.status as BookingStatus,
      to: "cancelled_by_customer",
      at: now,
      actorId: customerId,
      actorRole: "customer",
      reason,
    };

    const cancelled = await bookingsRepository.markCancelled(
      bookingId,
      customerId,
      booking.status as BookingStatus,
      historyEntry,
      reason,
      isPaid && quote.refundAmount > 0
        ? "PENDING_APPROVAL"
        : "NOT_REQUIRED",
    );

    if (!cancelled) {
      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        "The booking was updated concurrently; please refresh and try again",
      );
    }

    await referralsService.refundWalletUsed(bookingId).catch(() => null);

    let refundStatus: CancellationSummary["refundStatus"] = "none";

    if (quote.refundAmount > 0 && isPaid) {
      try {
        const refund = (await bookingsRepository.createRefundRequest({
          payment: paidRecord,
          bookingId,
          customerId,
          amount: quote.refundAmount,
          reason,
          now,
        })) as { _id?: unknown } | null;

        refundStatus = "requested";

        if (refund?._id) {
          void Promise.resolve(
            alertRefundRequested({
              refundId: String(refund._id),
              bookingId,
              amount: quote.refundAmount,
            }),
          ).catch(() => undefined);
        }
      } catch {
        throw new AppError(
          500,
          "REFUND_REQUEST_FAILED",
          "Your booking is cancelled, but we could not file the refund request. Please contact support.",
        );
      }
    }

    const updatedBooking = await BookingService.getBooking(
      customerId,
      bookingId,
    );
    const hoursUntilSlot = Math.max(
      0,
      Math.round((slotStart.getTime() - now.getTime()) / 3_600_000),
    );

    return {
      booking: updatedBooking,
      cancellation: {
        ...quote,
        hoursUntilSlot,
        refundMethod:
          quote.refundAmount > 0 && isPaid ? ("WALLET" as const) : null,
        refundStatus,
      },
    };
  },

  /**
   * Reschedules a booking while holding the slot lock.
   */
  async rescheduleBooking(
    customerId: string,
    bookingId: string,
    input: { date: string; slot: string },
  ) {
    const booking = await bookingsRepository.findByIdForCustomer(
      bookingId,
      customerId,
    );

    if (!booking) {
      throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
    }

    if (!RESCHEDULABLE_STATUSES.includes(booking.status as BookingStatus)) {
      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        `A booking can't be rescheduled while it is ${booking.status}`,
      );
    }

    const rawServiceId = (booking as { serviceId?: unknown }).serviceId;
    const serviceId = String(
      (rawServiceId as { _id?: unknown })?._id ?? rawServiceId,
    );

    if (!serviceId || !booking.date || !booking.slot) {
      throw new AppError(
        409,
        "BOOKING_NOT_RESCHEDULABLE",
        "This booking has no slot that can be changed",
      );
    }

    if (booking.partnerId) {
      throw new AppError(
        409,
        "BOOKING_NOT_RESCHEDULABLE",
        hasSlotStarted(booking.date, booking.slot)
          ? "This booking has already started"
          : "A partner has already been assigned to this booking",
      );
    }

    if (booking.date === input.date && booking.slot === input.slot) {
      throw new AppError(400, "SAME_SLOT", "Pick a different date or time slot");
    }

    assertBookableDate(input.date);
    if (hasSlotStarted(input.date, input.slot)) {
      throw new AppError(
        409,
        "SLOT_UNAVAILABLE",
        "Selected slot is no longer available",
      );
    }

    const capacity = await bookingSettings.getSlotCapacity(serviceId);
    const now = new Date();
    const fromDate = booking.date;
    const fromSlot = booking.slot;
    const fromStatus = booking.status as BookingStatus;

    try {
      return await withSlotLock(
        `booking:${serviceId}:${input.date}:${input.slot}`,
        async () => {
          await bookingsRepository.releaseStaleHolds(
            serviceId,
            input.date,
            input.slot,
            now,
          );

          const seat = await bookingsRepository.findFreeSeat(
            serviceId,
            input.date,
            input.slot,
            capacity,
            now,
          );

          if (seat === null) {
            throw new AppError(
              409,
              "SLOT_UNAVAILABLE",
              "Selected slot is no longer available",
            );
          }

          const historyEntry: StatusHistoryEntry = {
            from: fromStatus,
            to: fromStatus,
            at: now,
            actorId: customerId,
            actorRole: "customer",
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
          });

          if (!updated) {
            throw new AppError(
              409,
              "INVALID_STATE_TRANSITION",
              "The booking was updated concurrently; please refresh and try again",
            );
          }

          return BookingService.getBooking(customerId, bookingId);
        },
      );
    } catch (error) {
      if (isDuplicateKey(error, "uniq_active_slot_seat")) {
        throw new AppError(
          409,
          "SLOT_UNAVAILABLE",
          "Selected slot is no longer available",
        );
      }
      throw error;
    }
  },

  async listBookings(customerId: string, query: ListBookingsQuery) {
    const { items, total } =
      await bookingsRepository.listPageForCustomer(customerId, query);

    return {
      items: items.map((booking) => toView(booking as never)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },
};
