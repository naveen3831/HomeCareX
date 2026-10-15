/**
 * The customer's invoice for ONE paid booking (GET /bookings/:id/invoice).
 *
 * Pure on purpose (no DB, no Express): it only reads the customer-facing booking view that
 * buildDetailView already produced, so internal fields (partner earning, OTP, idempotency data)
 * can never leak into an invoice, and the layout can be unit tested without a database.
 */

export interface InvoiceCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface InvoiceItem {
  /** "BASE" | "ADDON" | ... as priced by the booking; used to split "Service charge" from "Add-ons". */
  kind?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNo: string;
  /** Shown as "Receipt No" on the printed receipt. */
  receiptNo: string;
  bookingCode: string;
  issuedOn: string;
  customer: InvoiceCustomer;
  service: string;
  partner: string | null;
  partnerPhone?: string;
  serviceDate: string;
  slot: string;
  address: string;
  items: InvoiceItem[];
  subtotal: number;
  surge: number;
  convenienceFee: number;
  discount: number;
  couponCode?: string;
  gst: number;
  extraCharges: InvoiceItem[];
  total: number;
  paymentStatus: string;
  paymentMethod?: string;
  transactionId?: string;
  paidOn?: string;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Same reference the customer sees on the details page. */
export function bookingCodeOf(view: Obj): string {
  const given = str(view.bookingNumber);
  if (given) return given;
  return `BK-${String(view._id ?? "")
    .slice(-5)
    .toUpperCase()}`;
}

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : IST_DATE.format(d);
}

/** "2026-10-12" (a calendar day, not an instant) as "12 Oct 2026". */
function formatDay(value: unknown): string {
  const s = str(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return formatDate(new Date(`${s}T00:00:00+05:30`));
}

function addressLine(value: unknown): string {
  if (!isObj(value)) return "";
  // "…, Hyderabad, Telangana 500072": the pincode follows the state with a space, not a comma.
  const statePin = [str(value.state), str(value.pincode)]
    .filter(Boolean)
    .join(" ");
  return [value.line1, value.line2, value.landmark, value.city]
    .map(str)
    .concat(statePin)
    .filter(Boolean)
    .join(", ");
}

function toItems(lines: unknown): InvoiceItem[] {
  if (!Array.isArray(lines)) return [];
  return lines.filter(isObj).map((l) => ({
    ...(str(l.kind) ? { kind: str(l.kind).toUpperCase() } : {}),
    name: str(l.name) || "Service",
    quantity: num(l.quantity) || 1,
    unitPrice: num(l.unitPrice),
    amount: num(l.amount),
  }));
}

/** Only approved extra charges are billed; pending and rejected ones never appear. */
function toExtraCharges(value: unknown): InvoiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObj)
    .filter((c) => c.status === "approved")
    .map((c) => ({
      name: str(c.title) || "Extra charge",
      quantity: 1,
      unitPrice: num(c.amount),
      amount: num(c.amount),
    }));
}

/** "RCPT-" plus the transaction reference (or the booking code when there is no transaction yet). */
function receiptNoOf(transactionId: string, bookingCode: string): string {
  const ref = (transactionId || bookingCode)
    .replace(/^(pay_|BK-)/i, "")
    .toUpperCase();
  return `RCPT-${ref}`;
}

/**
 * The assigned partner's name and phone. The booking view carries `partner`, but depending on how the booking was
 * loaded the name can also sit on `partner.userId` or on the populated `partnerId.userId`, so all are checked.
 */
function partnerOf(view: Obj): { name: string; phone: string } {
  const sources: Obj[] = [view.partner, view.partnerId]
    .filter(isObj)
    .flatMap((p) => (isObj(p.userId) ? [p, p.userId] : [p]));
  const pick = (...keys: string[]): string => {
    for (const src of sources)
      for (const k of keys) if (str(src[k])) return str(src[k]);
    return "";
  };
  return {
    name: pick("name", "fullName", "displayName"),
    phone: pick("phone", "mobile"),
  };
}

/** A payment document (mongoose doc or plain object) as a plain object. */
function plain(record: unknown): Obj {
  if (!isObj(record)) return {};
  const withToObject = record as { toObject?: () => unknown };
  const out =
    typeof withToObject.toObject === "function"
      ? withToObject.toObject()
      : record;
  return isObj(out) ? out : {};
}

/**
 * Fills the booking view's payment details from the paid Payment record, only where the view has nothing.
 * The view's own lookup is best-effort and can come back empty (or without a method / reference / date) even though
 * the booking is PAID, which left the receipt showing "—". Never overwrites a value the view already has.
 */
export function withPaymentRecord(view: Obj, record: unknown): Obj {
  const rec = plain(record);
  if (Object.keys(rec).length === 0) return view;
  const have = isObj(view.paymentDetails) ? view.paymentDetails : {};
  const first = (...vals: unknown[]): unknown =>
    vals.find((v) => (typeof v === "string" ? v.trim() !== "" : v != null));
  return {
    ...view,
    paymentDetails: {
      ...have,
      method: first(have.method, rec.method),
      transactionId: first(
        have.transactionId,
        have.paymentId,
        rec.razorpayPaymentId,
        rec.transactionId,
        rec.razorpayOrderId,
        rec._id && String(rec._id),
      ),
      paidAt: first(have.paidAt, rec.paidAt, rec.updatedAt, rec.createdAt),
    },
  };
}

export function buildInvoiceData(
  view: Obj,
  customer: InvoiceCustomer,
): InvoiceData {
  const price = isObj(view.priceSnapshot) ? view.priceSnapshot : {};
  const pay = isObj(view.paymentDetails) ? view.paymentDetails : {};
  const partner = partnerOf(view);
  const service = isObj(view.service) ? str(view.service.name) : "";
  const extraCharges = toExtraCharges(view.extraCharges);
  const bookingCode = bookingCodeOf(view);

  const total = round2(
    num(price.total) + extraCharges.reduce((sum, c) => sum + c.amount, 0),
  );
  const couponCode = str(price.couponCode);
  const method = str(pay.method) || str(view.paymentMethod);
  const transactionId =
    str(pay.transactionId) || str(pay.paymentId) || str(pay.razorpayPaymentId);
  const paidOn = formatDate(pay.paidAt) || formatDate(view.paidAt);

  return {
    invoiceNo: `INV-${bookingCode}`,
    receiptNo: receiptNoOf(transactionId, bookingCode),
    bookingCode,
    issuedOn:
      paidOn || formatDate(view.completedAt) || formatDate(view.updatedAt),
    customer,
    service: service || str(view.serviceName) || "Service",
    partner: partner.name || null,
    ...(partner.phone ? { partnerPhone: partner.phone } : {}),
    serviceDate: formatDay(view.date),
    slot: str(view.slot),
    address: addressLine(view.addressSnapshot),
    items: toItems(price.lines),
    subtotal: num(price.subtotal),
    surge: num(price.surge),
    convenienceFee: num(price.convenienceFee),
    discount: num(price.discount),
    ...(couponCode ? { couponCode } : {}),
    gst: num(price.gst),
    extraCharges,
    total,
    paymentStatus: str(view.paymentStatus) || "PENDING",
    ...(method ? { paymentMethod: method } : {}),
    ...(transactionId ? { transactionId } : {}),
    ...(paidOn ? { paidOn } : {}),
  };
}

/** Escapes text for HTML. Names and addresses are customer-typed, so nothing goes in unescaped. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money = (n: number): string => `₹${inr.format(n)}`;

/** "NETBANKING" / "netbanking" -> "Netbanking"; short codes such as "UPI" stay upper-case. */
function prettyMethod(method: string): string {
  const m = method.trim();
  if (m.length <= 4) return m.toUpperCase();
  return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

/** "10:00-12:00" -> "10:00–12:00" */
const prettySlot = (slot: string): string => slot.replace(/\s*[-–]\s*/, "–");

/**
 * Fallback HomeCareX wordmark, drawn inline so the receipt is always self-contained (no remote images).
 * The web app swaps the <!--logo-->…<!--/logo--> block for the real logo image (see InvoiceCard.tsx).
 */
const LOGO = `<svg class="logo" viewBox="0 0 150 40" width="150" height="40" role="img" aria-label="HomeCareX">
  <path d="M4 20 L20 6 L36 20" fill="none" stroke="#2f3a8f" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 19 L20 10 L31 19 V33 a3 3 0 0 1 -3 3 H12 a3 3 0 0 1 -3 -3 Z" fill="#f47b20"/>
  <path d="M20 31 l-5.2 -5.1 a3.1 3.1 0 0 1 4.4 -4.4 l0.8 0.8 l0.8 -0.8 a3.1 3.1 0 0 1 4.4 4.4 Z" fill="#fff"/>
  <text x="42" y="27" font-family="Poppins,'Segoe UI',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="-0.4"><tspan fill="#f47b20">HOME</tspan><tspan fill="#2f3a8f">CAREX</tspan></text>
  <text x="141" y="14" font-family="Arial,sans-serif" font-size="5" fill="#2f3a8f">®</text>
</svg>`;

const STYLE = `
  :root{color-scheme:light;--ink:#1a1730;--muted:#6b6880;--accent:#3a2fc2;--line:#e6e4ee;--tint:#ecebf9;--units:60}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{margin:0;padding:12px;font-family:Poppins,"Segoe UI",-apple-system,Roboto,Arial,sans-serif;font-size:14px;line-height:1.4;color:var(--ink);background:#f1f1f5}
  /* Desktop / landscape: size the text from the window height so the whole receipt is on screen at once. */
  @media (min-width:900px) and (min-height:480px){
    body{font-size:clamp(10px,calc((100vh - 24px) / var(--units)),15px)}
  }
  .sheet{max-width:72em;margin:0 auto;background:#fff;border-radius:1em;padding:1.3em 1.5em 1.2em;box-shadow:0 1px 6px rgba(26,23,48,.12)}
  p,h1,h2,td,th,.value{margin:0;overflow-wrap:anywhere}
  .cols>div,.pay>div,.brand,.rcpt{min-width:0}
  :focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:4px}
  .head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:.6em 1em;padding-bottom:.8em;border-bottom:2px solid var(--ink)}
  .brand .logo{display:block;max-width:100%}
  .brand svg.logo{height:2.9em;width:auto}
  .brand img.logo{height:3.4em;width:auto}
  .brand .tag{margin-top:.3em;padding-left:.3em;font-size:.93em;color:var(--muted)}
  .rcpt{text-align:right;max-width:100%}
  .rcpt h1{margin:0 0 .1em;font-size:1.5em;font-weight:700;line-height:1.2}
  .rcpt .sub{font-size:.93em;color:var(--muted);line-height:1.45}
  .badge{display:inline-block;margin-top:.4em;padding:.1em .9em;border-radius:999px;border:1px solid #b9e5c9;background:#e9f8ef;color:#17803a;font-size:.86em;font-weight:700;letter-spacing:.04em}
  .badge.due{border-color:#f3d9a8;background:#fdf3e0;color:#9a5b00}
  .cols{display:grid;grid-template-columns:1fr 1fr;column-gap:1em}
  .grid2{display:grid;grid-template-columns:1fr 1fr;column-gap:1em}
  h2{margin:.9em 0 .45em;padding-bottom:.25em;border-bottom:1px solid var(--line);font-size:.93em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent)}
  .field{margin-bottom:.3em}
  .field.wide{margin-top:.2em}
  .label{display:block;font-size:.86em;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
  .value{display:block;font-size:1.07em}
  .pay{display:grid;grid-template-columns:repeat(4,1fr);column-gap:1em}
  table{width:100%;border-collapse:collapse;margin-top:.6em}
  thead th{padding:.5em 1.3em;background:#f7f7fb;font-size:.86em;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left}
  td{padding:.4em 1.3em;border-bottom:1px solid var(--line);font-size:1em;color:var(--muted)}
  .r{text-align:right}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .item{display:block;margin-top:1px;font-size:.86em;color:var(--muted)}
  td.r{font-weight:700;color:var(--ink);white-space:nowrap;overflow-wrap:normal;width:1%}
  tr.strong td{color:var(--ink);font-weight:600}
  tr.total td{padding:.65em 1.3em;background:var(--tint);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);font-weight:700;color:var(--ink);text-transform:uppercase}
  tr.total td.r{color:var(--accent);font-size:1.07em}
  .thanks{margin-top:.9em}
  .thanks .big{font-size:1.07em;font-weight:700}
  .thanks .name{font-size:.93em;font-weight:700}
  .thanks .small{font-size:.93em;color:var(--muted)}
  @media (max-width:820px){
    .pay{grid-template-columns:repeat(2,1fr)}
  }
  @media (max-width:560px){
    body{padding:8px}
    .sheet{padding:1.4em 1em 1.5em;border-radius:.9em}
    .head{flex-direction:column}
    .rcpt{text-align:left;width:100%}
    .cols,.grid2{grid-template-columns:1fr}
    td,thead th,tr.total td{padding-left:.75em;padding-right:.75em}
  }
  @page{size:A4;margin:12mm}
  @media print{
    body{padding:0;background:#fff;font-size:13px}
    .sheet{max-width:none;padding:0;border-radius:0;box-shadow:none}
    .cols,.grid2{grid-template-columns:1fr 1fr}
    .pay{grid-template-columns:repeat(4,1fr)}
    .head{flex-direction:row}
    .rcpt{text-align:right;width:auto}
    tr,.thanks{break-inside:avoid}
  }
`;

/** Height of the fixed parts of the receipt (header, details, payment info, footer), in em. Calibrated by measuring. */
const UNITS_BASE = 44;

function field(label: string, value: string, extra = ""): string {
  return `<div class="field${extra}"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

/** "Fridge × 2 (₹60.00 each)" - one entry per priced item, shown in small text under its row. */
function itemDetail(i: InvoiceItem): string {
  return i.quantity > 1
    ? `${i.name} × ${i.quantity} (${money(i.unitPrice)} each)`
    : i.name;
}

function line(
  label: string,
  amount: number,
  opts: { minus?: boolean; strong?: boolean; items?: InvoiceItem[] } = {},
): string {
  const detail = (opts.items ?? [])
    .map(
      (i) =>
        `<span class="item">${escapeHtml(itemDetail(i))} — ${money(i.amount)}</span>`,
    )
    .join("");
  return `<tr${opts.strong ? ' class="strong"' : ""}><td>${escapeHtml(label)}${detail}</td><td class="r">${opts.minus ? "−" : ""}${money(amount)}</td></tr>`;
}

export function renderInvoiceHtml(d: InvoiceData): string {
  const e = escapeHtml;
  const paid = d.paymentStatus.toUpperCase() === "PAID";

  const all = d.items;
  const addOnTotal = round2(
    all.filter((i) => i.kind === "ADDON").reduce((s, i) => s + i.amount, 0),
  );
  const lineTotal = round2(all.reduce((s, i) => s + i.amount, 0));
  const subtotal = d.subtotal > 0 ? d.subtotal : lineTotal;
  const serviceCharge = round2(subtotal - addOnTotal);

  const addOnItems = all.filter((i) => i.kind === "ADDON");
  const serviceItems = all.filter((i) => i.kind !== "ADDON");

  const rows = [
    serviceCharge > 0
      ? line("Service charge", serviceCharge, { items: serviceItems })
      : "",
    addOnTotal > 0 ? line("Add-ons", addOnTotal, { items: addOnItems }) : "",
    line("Subtotal", subtotal, { strong: true }),
    d.surge > 0 ? line("Surge", d.surge) : "",
    d.discount > 0
      ? line(
          d.couponCode ? `Discount (${d.couponCode})` : "Discount",
          d.discount,
          { minus: true },
        )
      : "",
    d.convenienceFee > 0 ? line("Convenience fee", d.convenienceFee) : "",
    d.gst > 0 ? line("GST", d.gst) : "",
    ...d.extraCharges.map((c) => line(c.name, c.amount)),
  ].join("");

  const customerFields = [
    field("Name", d.customer.name || "—"),
    d.customer.email ? field("Email", d.customer.email) : "",
    d.customer.phone ? field("Phone", d.customer.phone) : "",
  ].join("");

  const bookingFields = [
    field("Service", d.service),
    field("Partner", d.partner ?? "Not assigned yet"),
    d.partner && d.partnerPhone ? field("Partner Phone", d.partnerPhone) : "",
    field("Booking ID", d.bookingCode),
    d.serviceDate ? field("Service Date", d.serviceDate) : "",
    d.slot ? field("Time", prettySlot(d.slot)) : "",
  ].join("");

  const paidOn = d.paidOn || d.issuedOn || "—";

  // Rough height of the receipt in em (rows, item lines, long address), used to fit it to the window height.
  const rowCount = (rows.match(/<tr/g) ?? []).length;
  const detailCount = (rows.match(/class="item"/g) ?? []).length;
  const addressLines = Math.max(1, Math.ceil(d.address.length / 110));
  const units = Math.ceil(
    UNITS_BASE + rowCount * 2.5 + detailCount * 1.3 + (addressLines - 1) * 1.5,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Invoice ${e(d.invoiceNo)}</title>
<style>${STYLE}</style>
<style>:root{--units:${units}}</style>
</head>
<body>
<main class="sheet" aria-label="Payment receipt">
  <div class="head">
    <div class="brand">
      <!--logo-->${LOGO}<!--/logo-->
      <p class="tag">Home Services &amp; Care</p>
    </div>
    <div class="rcpt">
      <h1>Payment Receipt</h1>
      <p class="sub">Invoice No: ${e(d.invoiceNo)}</p>
      <p class="sub">Receipt No: ${e(d.receiptNo)}</p>
      ${d.issuedOn ? `<p class="sub">Date: ${e(d.issuedOn)}</p>` : ""}
      <span class="badge${paid ? "" : " due"}">${e(d.paymentStatus.toUpperCase())}</span>
    </div>
  </div>

  <div class="cols">
    <div><h2>Customer</h2>${customerFields}</div>
    <div><h2>Booking</h2><div class="grid2">${bookingFields}</div></div>
  </div>
  ${d.address ? field("Service Address", d.address, " wide") : ""}

  <h2>Payment Information</h2>
  <div class="pay">
    ${field("Payment Method", d.paymentMethod ? prettyMethod(d.paymentMethod) : "—")}
    ${field("Transaction ID", d.transactionId || "—")}
    ${field("Payment Date", paidOn)}
    ${field("Payment Status", d.paymentStatus.toUpperCase())}
  </div>

  <table>
    <caption class="sr">Payment breakdown</caption>
    <thead><tr><th scope="col">Description</th><th scope="col" class="r">Amount</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total"><td>${paid ? "Total Paid" : "Total"}</td><td class="r">${money(d.total)}</td></tr>
    </tbody>
  </table>

  <div class="thanks">
    <p class="big">Thank you for choosing HomeCareX.</p>
    <p class="name">HomeCareX</p>
    <p class="small">Professional Home Services</p>
  </div>
</main>
</body>
</html>
`;
}
