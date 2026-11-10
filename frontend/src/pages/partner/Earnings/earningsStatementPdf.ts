import { earningsApi } from "@/services/earningsApi";
import { loadReceiptLogo } from "@/features/payments/receiptLogo.ts";
import type { EarningsFilters, LedgerRow } from "@/types/earnings";
import { dateFromInstant, timeFromInstant } from "./earningsFormat";

type RGB = [number, number, number];
const INK: RGB = [30, 27, 46];
const MUTED: RGB = [107, 104, 128];
const LINE: RGB = [228, 228, 239];
const BRAND: RGB = [67, 56, 202];
const ORANGE: RGB = [245, 115, 31];
const GREEN: RGB = [21, 128, 61];
const AMBER: RGB = [154, 82, 18];
const SOFT: RGB = [244, 243, 252];

const PAGE_SIZE = 100; // the server's maximum per request
const MAX_PAGES = 50; // safety stop: 5,000 rows

export interface StatementInfo {
  partnerName?: string;
  partnerPhone?: string;
}

/** "₹1,234.50" for the PDF. The embedded Noto Sans font has the rupee sign. */
const money = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Reads every page of the filtered ledger (oldest first, like a bank statement). */
async function fetchAllRows(filters: EarningsFilters): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await earningsApi.getLedger({ ...filters, page, limit: PAGE_SIZE });
    rows.push(...res.items);
    if (page >= res.pagination.pages) break;
  }
  return rows.sort((a, b) => +new Date(a.earnedAt) - +new Date(b.earnedAt));
}

const ymdLabel = (ymd: string): string => dateFromInstant(`${ymd}T12:00:00+05:30`);

function periodLabel(f: EarningsFilters, rows: LedgerRow[]): string {
  if (f.from && f.to) return f.from === f.to ? ymdLabel(f.from) : `${ymdLabel(f.from)} to ${ymdLabel(f.to)}`;
  if (rows.length) return `${dateFromInstant(rows[0].earnedAt)} to ${dateFromInstant(rows[rows.length - 1].earnedAt)}`;
  return "All time";
}

const statusText = (f: EarningsFilters): string =>
  f.status === "settled" ? "Paid out only" : f.status === "pending" ? "Pending only" : "All earnings";

/**
 * Builds a bank-statement style earnings PDF (A4, real text, HomeCareX logo, running balance,
 * repeated table header and "Page x of y" on every page). jsPDF and the font load on demand.
 */
export async function buildEarningsStatementPdf(
  filters: EarningsFilters,
  info: StatementInfo = {},
): Promise<{ save: () => void; fileName: string }> {
  const [rows, { jsPDF }, fonts, logo] = await Promise.all([
    fetchAllRows(filters),
    import("jspdf"),
    import("@/features/payments/receiptFonts"),
    loadReceiptLogo(),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("NotoSans-Regular.ttf", fonts.NOTO_SANS_REGULAR);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", fonts.NOTO_SANS_BOLD);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  const W = 210;
  const M = 14;
  const R = W - M;
  const CW = R - M;
  const TOP = 14;
  const BOTTOM = 297 - 18;
  const now = new Date();
  const generated = `${dateFromInstant(now.toISOString())}, ${timeFromInstant(now.toISOString())}`;
  const stamp = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).replace(/-/g, "");
  const statementNo = `HCX-ES-${stamp}-${String(Math.floor(now.getTime() / 1000) % 100000).padStart(5, "0")}`;

  const font = (bold: boolean, size: number, color: RGB) => {
    doc.setFont("NotoSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const rule = (yy: number, color: RGB = LINE, width = 0.25) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(M, yy, R, yy);
  };

  // ---- Totals (all rows in the filter) ----
  const totals = rows.reduce(
    (t, r) => {
      t.gross += r.gross;
      t.fees += r.commission;
      t.net += r.net;
      if (r.status === "settled") t.paid += r.net;
      else t.pending += r.net;
      return t;
    },
    { gross: 0, fees: 0, net: 0, paid: 0, pending: 0 },
  );

  // ---- Page 1 header ----
  let y = TOP;
  const LOGO = 15;
  let textX = M;
  if (logo) {
    doc.addImage(logo, "PNG", M, y, LOGO, LOGO);
    textX = M + LOGO + 3;
  }
  font(true, 20, ORANGE);
  doc.text("Home", textX, y + 8);
  const homeW = doc.getTextWidth("Home");
  font(true, 20, BRAND);
  doc.text("CareX", textX + homeW, y + 8);
  font(false, 9, MUTED);
  doc.text("Home Services & Care", textX, y + 13.5);

  font(true, 14, INK);
  doc.text("Earnings Statement", R, y + 6, { align: "right" });
  font(false, 8.5, MUTED);
  doc.text(`Statement no: ${statementNo}`, R, y + 11.5, { align: "right" });
  doc.text(`Generated: ${generated}`, R, y + 16, { align: "right" });

  y += 21;
  rule(y, INK, 0.5);
  y += 7;

  // ---- Partner + period ----
  const colW = CW / 2 - 4;
  const field = (x: number, yy: number, label: string, value: string) => {
    font(false, 7.5, MUTED);
    doc.text(label.toUpperCase(), x, yy);
    font(true, 10, INK);
    doc.text(doc.splitTextToSize(value, colW) as string[], x, yy + 4.8);
  };
  field(M, y, "Partner", info.partnerName || "HomeCareX Partner");
  field(M + CW / 2 + 4, y, "Statement period", periodLabel(filters, rows));
  y += 12;
  field(M, y, "Phone", info.partnerPhone || "-");
  field(M + CW / 2 + 4, y, "Showing", `${statusText(filters)} · ${rows.length} ${rows.length === 1 ? "job" : "jobs"}`);
  y += 13;

  // ---- Summary band ----
  doc.setFillColor(...SOFT);
  doc.roundedRect(M, y, CW, 22, 2, 2, "F");
  const cells: [string, string, RGB][] = [
    ["Gross earned", money(totals.gross), INK],
    ["Platform fees", `- ${money(totals.fees)}`, INK],
    ["Paid out", money(totals.paid), GREEN],
    ["Pending", money(totals.pending), AMBER],
    ["Net earned", money(totals.net), BRAND],
  ];
  const cw = CW / cells.length;
  cells.forEach(([label, value, color], i) => {
    const cx = M + i * cw + 4;
    font(false, 7.5, MUTED);
    doc.text(label.toUpperCase(), cx, y + 7.5);
    font(true, i === cells.length - 1 ? 11.5 : 10, color);
    doc.text(value, cx, y + 15);
  });
  y += 22 + 8;

  // ---- Table ----
  // Columns: Date | Details | Gross | Fee | Net | Balance | Status
  const cols = { date: M + 2, details: M + 26, gross: M + 96, fee: M + 118, net: M + 141, bal: M + 165, status: R - 1 };
  const header = () => {
    doc.setFillColor(...BRAND);
    doc.rect(M, y, CW, 8, "F");
    font(true, 7.5, [255, 255, 255]);
    doc.text("DATE", cols.date, y + 5.3);
    doc.text("DETAILS", cols.details, y + 5.3);
    doc.text("GROSS", cols.gross, y + 5.3, { align: "right" });
    doc.text("FEE", cols.fee, y + 5.3, { align: "right" });
    doc.text("NET", cols.net, y + 5.3, { align: "right" });
    doc.text("BALANCE", cols.bal, y + 5.3, { align: "right" });
    doc.text("STATUS", cols.status, y + 5.3, { align: "right" });
    y += 8;
  };
  header();

  if (rows.length === 0) {
    font(false, 10, MUTED);
    doc.text("No earnings found for this period.", W / 2, y + 16, { align: "center" });
    y += 26;
  }

  const ROW_H = 11;
  let running = 0;
  rows.forEach((r, i) => {
    if (y + ROW_H > BOTTOM) {
      doc.addPage();
      y = TOP;
      header();
    }
    running += r.net;
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 253);
      doc.rect(M, y, CW, ROW_H, "F");
    }
    // date
    font(true, 8.5, INK);
    doc.text(dateFromInstant(r.earnedAt), cols.date, y + 4.6);
    font(false, 7.5, MUTED);
    doc.text(timeFromInstant(r.earnedAt), cols.date, y + 8.6);
    // details
    font(true, 8.5, INK);
    const name = (doc.splitTextToSize(r.serviceName ?? "Service unavailable", 66) as string[])[0];
    doc.text(name, cols.details, y + 4.6);
    font(false, 7.5, MUTED);
    doc.text(`Booking #${r.bookingId.slice(-6).toUpperCase()}`, cols.details, y + 8.6);
    // money
    font(false, 8.5, INK);
    doc.text(money(r.gross), cols.gross, y + 6.3, { align: "right" });
    doc.text(`- ${money(r.commission)}`, cols.fee, y + 6.3, { align: "right" });
    font(true, 8.5, GREEN);
    doc.text(money(r.net), cols.net, y + 6.3, { align: "right" });
    font(false, 8.5, INK);
    doc.text(money(running), cols.bal, y + 6.3, { align: "right" });
    // status
    font(true, 7.5, r.status === "settled" ? GREEN : AMBER);
    doc.text(r.status === "settled" ? "Paid out" : "Pending", cols.status, y + 6.3, { align: "right" });

    y += ROW_H;
    rule(y);
  });

  // ---- Totals row ----
  if (rows.length > 0) {
    if (y + 14 > BOTTOM) {
      doc.addPage();
      y = TOP;
      header();
    }
    y += 1;
    rule(y, INK, 0.5);
    doc.setFillColor(238, 236, 251);
    doc.rect(M, y, CW, 10, "F");
    font(true, 9, INK);
    doc.text("TOTAL", cols.date, y + 6.6);
    doc.text(money(totals.gross), cols.gross, y + 6.6, { align: "right" });
    doc.text(`- ${money(totals.fees)}`, cols.fee, y + 6.6, { align: "right" });
    font(true, 9, GREEN);
    doc.text(money(totals.net), cols.net, y + 6.6, { align: "right" });
    font(true, 9, BRAND);
    doc.text(money(running), cols.bal, y + 6.6, { align: "right" });
    y += 10;
    rule(y, INK, 0.5);
    y += 6;
    font(false, 7.5, MUTED);
    doc.text("Balance is the running total of net earnings, oldest to newest. Net = Gross - Platform fee.", M, y);
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    rule(297 - 14, LINE);
    font(false, 7.5, MUTED);
    doc.text("HomeCareX · This is a computer-generated statement and does not require a signature.", M, 297 - 9.5);
    doc.text(`Page ${p} of ${pages}`, R, 297 - 9.5, { align: "right" });
  }

  const fileName = `HomeCareX-Earnings-Statement-${stamp}.pdf`;
  return { fileName, save: () => doc.save(fileName) };
}
