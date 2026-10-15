import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { bookingsRepository } from "./bookings.repository";
import { BookingService } from "./bookings.service";

/** The repository is swapped for a stub so these tests need no database. */
type Repo = typeof bookingsRepository;
const original = {
  findByIdForCustomer: bookingsRepository.findByIdForCustomer,
  getOrCreateStartOtp: bookingsRepository.getOrCreateStartOtp,
  findCustomerContact: bookingsRepository.findCustomerContact,
  findPaidPayment: bookingsRepository.findPaidPayment,
};
// No database in these tests: by default there is no Payment record.
beforeEach(() =>
  Object.assign(bookingsRepository, { findPaidPayment: async () => null }),
);
afterEach(() => Object.assign(bookingsRepository, original));
const stub = (patch: Partial<Record<keyof typeof original, unknown>>) =>
  Object.assign(bookingsRepository as Repo, patch);

const doc = (over: Record<string, unknown> = {}) => ({
  _id: "b1",
  status: "completed",
  paymentStatus: "PAID",
  priceSnapshot: {
    lines: [],
    subtotal: 500,
    discount: 0,
    convenienceFee: 0,
    gst: 90,
    total: 590,
  },
  extraCharges: [],
  ...over,
});

test("someone else's (or a missing) booking's invoice is a 404", async () => {
  stub({ findByIdForCustomer: async () => null });
  await assert.rejects(() => BookingService.getInvoice("other", "b1"), {
    statusCode: 404,
    code: "BOOKING_NOT_FOUND",
  });
});

test("an unpaid booking has no invoice yet (409)", async () => {
  stub({
    findByIdForCustomer: async () =>
      doc({ status: "confirmed", paymentStatus: "PENDING" }),
  });
  await assert.rejects(() => BookingService.getInvoice("c1", "b1"), {
    statusCode: 409,
    code: "INVOICE_NOT_AVAILABLE",
  });
});

test("a completed, paid booking returns the invoice with the customer on it", async () => {
  stub({
    findByIdForCustomer: async () => doc(),
    findCustomerContact: async () => ({ name: "Ravi", email: "r@example.com" }),
  });
  const { html, invoiceNo } = await BookingService.getInvoice("c1", "b1");
  assert.match(invoiceNo, /^INV-BK-/);
  assert.ok(html.includes("Ravi"));
  assert.ok(html.includes("₹590.00"));
});

test("the invoice still renders if the customer record cannot be read", async () => {
  stub({
    findByIdForCustomer: async () => doc(),
    findCustomerContact: async () => null,
  });
  const { html } = await BookingService.getInvoice("c1", "b1");
  assert.ok(html.includes("Invoice"));
});

test("method, transaction ID and date come from the paid Payment record when the booking view has none", async () => {
  stub({
    findByIdForCustomer: async () => doc(),
    findCustomerContact: async () => ({ name: "Ravi" }),
    findPaidPayment: async () => ({
      method: "netbanking",
      razorpayPaymentId: "pay_ABC123",
      paidAt: new Date("2026-10-08T08:00:00.000Z"),
    }),
  });
  const { html } = await BookingService.getInvoice("c1", "b1");
  assert.ok(html.includes("Netbanking"));
  assert.ok(html.includes("pay_ABC123"));
  assert.ok(html.includes("08 Oct 2026"));
});
