import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildInvoiceData,
  escapeHtml,
  renderInvoiceHtml,
  withPaymentRecord,
} from "./bookings.invoice";

const view = (over: Record<string, unknown> = {}) => ({
  _id: "65f0000000000000000abcde",
  status: "completed",
  paymentStatus: "PAID",
  date: "2026-10-12",
  slot: "10:00-12:00",
  service: { name: "Deep Cleaning" },
  partner: { name: "Asha K" },
  addressSnapshot: {
    line1: "12 MG Road",
    city: "Vijayawada",
    state: "AP",
    pincode: "520001",
  },
  priceSnapshot: {
    lines: [
      {
        kind: "BASE",
        name: "Deep Cleaning",
        unitPrice: 1000,
        quantity: 1,
        amount: 1000,
      },
      {
        kind: "ADDON",
        name: "Fridge",
        unitPrice: 200,
        quantity: 2,
        amount: 400,
      },
    ],
    subtotal: 1400,
    surge: 0,
    discount: 100,
    couponCode: "SAVE100",
    convenienceFee: 20,
    gst: 238,
    total: 1558,
  },
  extraCharges: [
    { _id: "x1", title: "Extra tools", amount: 300, status: "approved" },
    { _id: "x2", title: "Rejected thing", amount: 999, status: "rejected" },
    { _id: "x3", title: "Pending thing", amount: 888, status: "pending" },
  ],
  paymentDetails: {
    method: "UPI",
    transactionId: "pay_123",
    paidAt: "2026-10-12T08:00:00.000Z",
  },
  ...over,
});

test("the invoice carries the booking, service, partner, GST, discount and payment status", () => {
  const d = buildInvoiceData(view(), { name: "Ravi", email: "r@example.com" });
  assert.equal(d.invoiceNo, "INV-BK-ABCDE");
  assert.equal(d.service, "Deep Cleaning");
  assert.equal(d.partner, "Asha K");
  assert.equal(d.gst, 238);
  assert.equal(d.discount, 100);
  assert.equal(d.couponCode, "SAVE100");
  assert.equal(d.paymentStatus, "PAID");
  assert.equal(d.items.length, 2);
  assert.equal(d.address, "12 MG Road, Vijayawada, AP 520001");
});

test("only approved extra charges are billed, and they are added to the total", () => {
  const d = buildInvoiceData(view(), {});
  assert.deepEqual(
    d.extraCharges.map((c) => c.name),
    ["Extra tools"],
  );
  assert.equal(d.total, 1858);
});

test("the human booking number is used when there is one", () => {
  assert.equal(
    buildInvoiceData(view({ bookingNumber: "HCX-2001" }), {}).invoiceNo,
    "INV-HCX-2001",
  );
});

test("internal fields never reach the invoice", () => {
  const html = renderInvoiceHtml(
    buildInvoiceData(
      view({ partnerEarning: 777, otp: "4321", requestHash: "abc" }),
      {},
    ),
  );
  for (const secret of ["777", "4321", "requestHash", "partnerEarning"])
    assert.equal(html.includes(secret), false);
});

test("customer-typed text is escaped", () => {
  assert.equal(
    escapeHtml(`<script>"x"&'y'</script>`),
    "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;",
  );
  const html = renderInvoiceHtml(
    buildInvoiceData(view(), { name: "<img src=x onerror=alert(1)>" }),
  );
  assert.equal(html.includes("<img"), false);
  assert.ok(html.includes("&lt;img"));
});

test("the page is self-contained: no scripts and no remote resources", () => {
  const html = renderInvoiceHtml(buildInvoiceData(view(), {}));
  assert.equal(/<script|https?:\/\//i.test(html), false);
  assert.ok(html.includes("₹1,858.00"));
});

test("the receipt layout: receipt number, split charges, total paid and no partner details", () => {
  const d = buildInvoiceData(
    view({
      paymentDetails: {
        method: "NETBANKING",
        transactionId: "91158A95",
        paidAt: "2026-10-08T08:00:00.000Z",
      },
    }),
    { name: "Ravi" },
  );
  const html = renderInvoiceHtml(d);
  assert.equal(d.receiptNo, "RCPT-91158A95");
  for (const text of [
    "Payment Receipt",
    "Receipt No: RCPT-91158A95",
    "Service charge",
    "Add-ons",
    "Subtotal",
    "Convenience fee",
    "Total Paid",
    "Netbanking",
    "10:00–12:00",
    "Professional Home Services",
  ]) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes("₹1,000.00") && html.includes("₹400.00"));
});

test("the logo sits in a marked block so the web app can swap in the real image", () => {
  const html = renderInvoiceHtml(buildInvoiceData(view(), {}));
  assert.match(html, /<!--logo-->[\s\S]*<svg[\s\S]*<!--\/logo-->/);
});

test("every key detail is visible on the page: invoice no, booking, customer, service, partner, items, GST, discount, total, status", () => {
  const d = buildInvoiceData(view(), {
    name: "Ravi",
    email: "r@example.com",
    phone: "9000000001",
  });
  const html = renderInvoiceHtml(d);
  const text = html
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<[^>]+>/g, " ");
  for (const shown of [
    "Invoice No: INV-BK-ABCDE",
    "BK-ABCDE",
    "Ravi",
    "r@example.com",
    "9000000001",
    "Deep Cleaning",
    "Asha K",
    "Fridge × 2",
    "Extra tools",
    "GST",
    "₹238.00",
    "Discount (SAVE100)",
    "−₹100.00",
    "Total Paid",
    "₹1,858.00",
    "Payment Status",
    "PAID",
  ])
    assert.ok(text.includes(shown), shown);
});

test("the partner is shown with name and phone, wherever the booking carries them", () => {
  const direct = renderInvoiceHtml(
    buildInvoiceData(
      view({ partner: { name: "Asha K", phone: "9876500000" } }),
      {},
    ),
  );
  assert.ok(
    direct.includes("Partner") &&
      direct.includes("Asha K") &&
      direct.includes("9876500000"),
  );
  const nested = buildInvoiceData(
    view({
      partner: undefined,
      partnerId: { userId: { name: "Nested Nina", phone: "9000011111" } },
    }),
    {},
  );
  assert.equal(nested.partner, "Nested Nina");
  assert.equal(nested.partnerPhone, "9000011111");
});

test("a booking with no partner says so instead of dropping the row", () => {
  const html = renderInvoiceHtml(
    buildInvoiceData(view({ partner: undefined }), {}),
  );
  assert.ok(html.includes("Not assigned yet"));
});

test("payment details are filled from the Payment record, without overwriting what the booking already has", () => {
  const empty = view({ paymentDetails: undefined });
  const filled = buildInvoiceData(
    withPaymentRecord(empty, {
      method: "UPI",
      razorpayPaymentId: "pay_9",
      paidAt: "2026-10-08T08:00:00.000Z",
    }),
    {},
  );
  assert.equal(filled.paymentMethod, "UPI");
  assert.equal(filled.transactionId, "pay_9");
  assert.equal(filled.paidOn, "08 Oct 2026");
  const kept = buildInvoiceData(
    withPaymentRecord(view(), {
      method: "CARD",
      razorpayPaymentId: "pay_other",
    }),
    {},
  );
  assert.equal(kept.paymentMethod, "UPI");
  assert.equal(kept.transactionId, "pay_123");
});

test("the receipt never shows a blank payment date when the booking is paid", () => {
  const html = renderInvoiceHtml(
    buildInvoiceData(
      view({
        paymentDetails: undefined,
        completedAt: "2026-10-12T08:00:00.000Z",
      }),
      {},
    ),
  );
  assert.ok(/Payment Date<\/span><span class="value">12 Oct 2026/.test(html));
});
