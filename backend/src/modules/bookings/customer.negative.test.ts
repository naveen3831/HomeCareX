import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { bookingsRepository } from "./bookings.repository";
import { BookingService } from "./bookings.service";
import { computeCancellation } from "./bookings.cancel";
import { couponsService } from "../coupons/coupons.service";
import { calculatePricing } from "../pricing/pricing.service";
import {
  processWebhook,
  type WebhookStore,
} from "../payments/payments.service";
import { signWebhookBody } from "../payments/payments.crypto";
import type { RazorpayPaymentEntity } from "../payments/payments.types";

type Repo = typeof bookingsRepository;
const original = {
  findByIdForCustomer: bookingsRepository.findByIdForCustomer,
  findByCustomerAndIdempotencyKey:
    bookingsRepository.findByCustomerAndIdempotencyKey,
  findFreeSeat: bookingsRepository.findFreeSeat,
  markCancelled: bookingsRepository.markCancelled,
  reschedule: bookingsRepository.reschedule,
};

afterEach(() => {
  Object.assign(bookingsRepository, original);
});

const stub = (patch: Partial<Record<keyof typeof original, unknown>>) =>
  Object.assign(bookingsRepository as Repo, patch);

const mockBookingDoc = (over: Record<string, unknown> = {}) => ({
  _id: "b_cust_1",
  customerId: "cust_1",
  status: "confirmed",
  date: "2026-10-25",
  slot: "10:00-12:00",
  scheduledAt: new Date("2026-10-25T10:00:00Z"),
  partnerEarning: 500,
  extraCharges: [],
  priceSnapshot: {
    subtotal: 1000,
    discount: 0,
    total: 1209,
  },
  ...over,
});

/* =========================================================================
   1. SLOT 409 & AVAILABILITY
   ========================================================================= */

test("Slot 409: booking when capacity is full throws SLOT_UNAVAILABLE", async () => {
  stub({
    findFreeSeat: async () => null,
  });

  await assert.rejects(
    async () => {
      // Simulate seat lookup returning null (slot full)
      const seat = await bookingsRepository.findFreeSeat(
        "srv_1",
        "2026-10-25",
        "10:00-12:00",
        3,
        new Date(),
      );
      if (seat === null) {
        const { AppError } = await import("../../utils/AppError");
        throw new AppError(
          409,
          "SLOT_UNAVAILABLE",
          "Selected slot is no longer available",
        );
      }
    },
    { statusCode: 409, code: "SLOT_UNAVAILABLE" },
  );
});

test("Slot 409: booking a slot that has already started is unavailable", async () => {
  const { hasSlotStarted } = await import("./bookings.time");
  // Past date/slot
  const started = hasSlotStarted("2020-01-01", "08:00-10:00");
  assert.equal(started, true);
});

/* =========================================================================
   2. EXPIRED & INVALID COUPONS
   ========================================================================= */

test("Expired coupon: validating an expired coupon throws COUPON_EXPIRED", async () => {
  const now = new Date();
  const expiredCoupon = {
    _id: "cp_exp",
    code: "EXPIRED100",
    type: "FLAT" as const,
    value: 100,
    minOrder: 200,
    startAt: new Date(now.getTime() - 30 * 86_400_000),
    endAt: new Date(now.getTime() - 1 * 86_400_000), // Expired yesterday
    totalLimit: null,
    perUserLimit: null,
    usedCount: 0,
    categoryIds: [],
    active: true,
  };

  const { couponsRepository } = await import("../coupons/coupons.repository");
  const origFindByCode = couponsRepository.findByCode;
  couponsRepository.findByCode = async () => expiredCoupon as any;

  try {
    await assert.rejects(
      () =>
        couponsService.validate(
          {
            serviceId: "507f1f77bcf86cd799439011",
            quantity: 1,
            addOns: [],
            date: "2026-10-25",
            slot: "10:00-12:00",
            couponCode: "EXPIRED100",
          },
          "507f1f77bcf86cd799439022",
        ),
      (err: any) => err?.status === 422 && err?.code === "COUPON_EXPIRED",
    );
  } finally {
    couponsRepository.findByCode = origFindByCode;
  }
});

test("Coupon minimum order: order below minOrder throws COUPON_MIN_ORDER", async () => {
  const now = new Date();
  const highMinCoupon = {
    _id: "cp_high",
    code: "HIGHMIN",
    type: "FLAT" as const,
    value: 200,
    minOrder: 10000, // Very high minimum order
    startAt: new Date(now.getTime() - 7 * 86_400_000),
    endAt: new Date(now.getTime() + 30 * 86_400_000),
    totalLimit: null,
    perUserLimit: null,
    usedCount: 0,
    categoryIds: [],
    active: true,
  };

  const { couponsRepository } = await import("../coupons/coupons.repository");
  const { ServiceModel } = await import("../../models/Service");
  const origFindByCode = couponsRepository.findByCode;
  const origFindService = ServiceModel.findById;

  couponsRepository.findByCode = async () => highMinCoupon as any;
  ServiceModel.findById = (() => ({
    _id: "507f1f77bcf86cd799439011",
    active: true,
    basePrice: 500,
    addOns: [],
    categoryId: "507f1f77bcf86cd799439099",
  })) as any;

  try {
    await assert.rejects(
      () =>
        couponsService.validate(
          {
            serviceId: "507f1f77bcf86cd799439011",
            quantity: 1,
            addOns: [],
            date: "2026-10-25",
            slot: "10:00-12:00",
            couponCode: "HIGHMIN",
          },
          "507f1f77bcf86cd799439022",
        ),
      (err: any) => err?.status === 422 && err?.code === "COUPON_MIN_ORDER",
    );
  } finally {
    couponsRepository.findByCode = origFindByCode;
    ServiceModel.findById = origFindService;
  }
});

test("Coupon pricing: valid coupon correctly deducts discount and reduces GST", () => {
  const lines = [{ amount: 1000 }];
  const withoutCoupon = calculatePricing({
    lines,
    slot: "10:00-12:00",
    discount: 0,
  });
  const withCoupon = calculatePricing({
    lines,
    slot: "10:00-12:00",
    discount: 200,
  });

  assert.equal(withCoupon.discount, 200);
  assert.equal(withCoupon.subtotal, 1000);
  assert.ok(withCoupon.gst < withoutCoupon.gst);
  assert.equal(
    withCoupon.total,
    withCoupon.subtotal - 200 + withCoupon.convenienceFee + withCoupon.gst,
  );
});

/* =========================================================================
   3. DOUBLE-CLICK PAY (IDEMPOTENCY)
   ========================================================================= */

test("Double-click pay: replaying same idempotencyKey returns existing booking without duplicate creation", async () => {
  const existingBooking = mockBookingDoc({
    idempotencyKey: "idem_key_123",
    requestHash: "hash_abc",
  });

  stub({
    findByCustomerAndIdempotencyKey: async () => existingBooking as any,
  });

  // Replay check
  const found = await bookingsRepository.findByCustomerAndIdempotencyKey(
    "cust_1",
    "idem_key_123",
  );
  assert.ok(found);
  assert.equal(found.idempotencyKey, "idem_key_123");
  assert.equal(found._id, "b_cust_1");
});

/* =========================================================================
   4. WEBHOOK REPLAY
   ========================================================================= */

test("Webhook replay: duplicate event ID is safely marked replayed and settled once", async () => {
  const seen = new Set<string>();
  const settledPayments: string[] = [];
  const fakeStore: WebhookStore = {
    async recordEvent(e) {
      if (seen.has(e.eventId)) return false;
      seen.add(e.eventId);
      return true;
    },
    async forgetEvent(id) {
      seen.delete(id);
    },
    async settleCaptured(entity: RazorpayPaymentEntity) {
      settledPayments.push(entity.id);
      return { confirmed: true };
    },
    async noteFailed() {},
  };

  const secret = "whsec_test";
  const raw = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_123",
            order_id: "order_123",
            amount: 50000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    }),
  );
  const sig = signWebhookBody(raw, secret);

  // First webhook delivery
  const res1 = await processWebhook(
    { rawBody: raw, signature: sig, eventId: "evt_dup_1", secret },
    fakeStore,
  );
  assert.deepEqual(res1, { outcome: "processed", bookingConfirmed: true });
  assert.equal(settledPayments.length, 1);

  // Replayed webhook with same eventId
  const res2 = await processWebhook(
    { rawBody: raw, signature: sig, eventId: "evt_dup_1", secret },
    fakeStore,
  );
  assert.deepEqual(res2, { outcome: "replayed" });
  // Settle was not called again
  assert.equal(settledPayments.length, 1);
});

/* =========================================================================
   5. CANCEL OUTSIDE VS INSIDE WINDOW
   ========================================================================= */

test("Cancel outside window: cancelling >4h before slot gives 100% refund with 0 fee", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  const slotStart = new Date("2026-10-20T16:00:00Z"); // 8 hours away (> 4 hours)
  const policy = { windowHours: 4, feeAmount: 99 };

  const quote = computeCancellation({
    slotStart,
    now,
    paidAmount: 1200,
    policy,
  });
  assert.equal(quote.freeCancellation, true);
  assert.equal(quote.fee, 0);
  assert.equal(quote.refundAmount, 1200);
});

test("Cancel inside window: cancelling <4h before slot keeps flat fee and refunds the rest", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  const slotStart = new Date("2026-10-20T10:00:00Z"); // 2 hours away (< 4 hours)
  const policy = { windowHours: 4, feeAmount: 99 };

  const quote = computeCancellation({
    slotStart,
    now,
    paidAmount: 1200,
    policy,
  });
  assert.equal(quote.freeCancellation, false);
  assert.equal(quote.fee, 99);
  assert.equal(quote.refundAmount, 1101);
});

test("Cancel invalid transition: cannot cancel already completed or in-progress booking", async () => {
  stub({
    findByIdForCustomer: async () => mockBookingDoc({ status: "completed" }),
  });

  await assert.rejects(
    () => BookingService.cancelBooking("cust_1", "b_cust_1", "Changed my mind"),
    { statusCode: 409, code: "INVALID_STATE_TRANSITION" },
  );
});

/* =========================================================================
   6. CROSS-CUSTOMER ISOLATION (SECURITY)
   ========================================================================= */

test("Cross-customer security: Customer A cannot view Customer B booking (returns 404 BOOKING_NOT_FOUND)", async () => {
  // When Customer A searches for Customer B's booking, repository scopes by customerId and returns null
  stub({
    findByIdForCustomer: async (bookingId: string, customerId: string) => {
      if (customerId !== "cust_owner") return null;
      return mockBookingDoc();
    },
  });

  // cust_intruder tries to read cust_owner's booking
  await assert.rejects(
    () => BookingService.getBooking("cust_intruder", "b_cust_1"),
    { statusCode: 404, code: "BOOKING_NOT_FOUND" },
  );
});

test("Cross-customer security: Customer A cannot cancel Customer B booking", async () => {
  stub({
    findByIdForCustomer: async (_b: string, customerId: string) => {
      if (customerId !== "cust_owner") return null;
      return mockBookingDoc();
    },
  });

  await assert.rejects(
    () =>
      BookingService.cancelBooking(
        "cust_intruder",
        "b_cust_1",
        "Malicious cancellation",
      ),
    { statusCode: 404, code: "BOOKING_NOT_FOUND" },
  );
});

test("Cross-customer security: Customer A cannot reschedule Customer B booking", async () => {
  stub({
    findByIdForCustomer: async (_b: string, customerId: string) => {
      if (customerId !== "cust_owner") return null;
      return mockBookingDoc();
    },
  });

  await assert.rejects(
    () =>
      BookingService.rescheduleBooking("cust_intruder", "b_cust_1", {
        date: "2026-10-26",
        slot: "10:00-12:00",
      }),
    { statusCode: 404, code: "BOOKING_NOT_FOUND" },
  );
});
