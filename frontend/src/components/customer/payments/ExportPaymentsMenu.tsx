import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Download, FileSpreadsheet, Printer, Share2 } from "lucide-react";
import { methodLabel } from "@/features/payments";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { PaymentRecordStatus, PaymentRow } from "@/types/payment";

export interface ExportPaymentsMenuProps {
  payments: PaymentRow[];
  activeFilter?: "" | PaymentRecordStatus | string;
  variant?: "desktop" | "mobile";
  disabled?: boolean;
  className?: string;
  onFetchAll?: () => Promise<PaymentRow[]>;
}

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
};

const escapeCsv = (val: unknown): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/** Build clean CSV string with UTF-8 BOM so INR symbol ₹ renders correctly in Excel / Sheets */
export function buildPaymentsCsv(payments: PaymentRow[]): string {
  const headers = [
    "Transaction ID",
    "Booking Title",
    "Booking ID",
    "Date",
    "Amount (INR)",
    "Payment Method",
    "Status",
  ];

  const rows = payments.map((p) => {
    const txId = p.id.slice(-8).toUpperCase();
    const title = p.serviceName;
    const bookingId = p.bookingRef;
    const date = fmtDate(p.paidAt ?? p.createdAt);
    const amount = `₹${(Number(p.amount) || 0).toFixed(2)}`;
    const method = methodLabel(p.method);
    const status = p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase() : "";

    return [txId, title, bookingId, date, amount, method, status].map(escapeCsv).join(",");
  });

  return "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
}

/** Build branded HTML statement for browser window.print() / Save as PDF */
export function buildPaymentsStatementHtml(payments: PaymentRow[], activeFilter?: string): string {
  const filterLabel = (activeFilter || "All").toUpperCase();
  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const totalCount = payments.length;
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const formattedTotalPaid = `₹${totalPaid.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const tableRows = payments
    .map((p, idx) => {
      const txId = p.id.slice(-8).toUpperCase();
      const date = fmtDate(p.paidAt ?? p.createdAt);
      const method = methodLabel(p.method);
      const amount = `₹${(Number(p.amount) || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
      const statusClass =
        p.status === "PAID"
          ? "badge-paid"
          : p.status === "PENDING"
          ? "badge-pending"
          : p.status === "FAILED"
          ? "badge-failed"
          : "badge-refunded";
      const statusLabel = p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase();

      return `
        <tr>
          <td style="color:#64748b;font-size:12px;">${idx + 1}</td>
          <td style="font-family:monospace;font-size:12px;color:#334155;font-weight:600;">${txId}</td>
          <td>
            <div style="font-weight:600;color:#0f172a;">${p.serviceName}</div>
            <div style="font-size:11px;color:#64748b;font-family:monospace;">${p.bookingRef}</div>
          </td>
          <td style="color:#475569;font-size:13px;">${date}</td>
          <td style="color:#475569;font-size:13px;">${method}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td style="text-align:right;font-weight:700;color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;">${amount}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>HomeCareX - Payment Statement</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 32px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-accent { color: #f97316; }
    .brand-name { color: #4f46e5; }
    .statement-title { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .meta-box { text-align: right; }
    .filter-badge {
      display: inline-block;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .date-str { font-size: 12px; color: #64748b; }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
    }
    .card-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .card-value.highlight { color: #4f46e5; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      padding: 10px 12px;
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      vertical-align: middle;
    }
    tr:nth-child(even) td { background-color: #fafbfc; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-paid { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #ffedd5; color: #c2410c; }
    .badge-failed { background: #fee2e2; color: #dc2626; }
    .badge-refunded { background: #ede9fe; color: #7c3aed; }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand"><span class="brand-accent">Home</span><span class="brand-name">CareX</span></div>
      <div class="statement-title">Official Customer Payment Statement</div>
    </div>
    <div class="meta-box">
      <div class="filter-badge">Filter: ${filterLabel}</div>
      <div class="date-str">Generated on ${todayFormatted}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="card">
      <div class="card-label">Total Transactions</div>
      <div class="card-value">${totalCount}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Paid Amount</div>
      <div class="card-value highlight">${formattedTotalPaid}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th style="width: 100px;">Transaction ID</th>
        <th>Booking / Service</th>
        <th style="width: 110px;">Date</th>
        <th style="width: 110px;">Method</th>
        <th style="width: 85px;">Status</th>
        <th style="width: 100px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <p>This is a computer-generated statement from HomeCareX Platform. Receipts for individual bookings can be downloaded from your account.</p>
    <p style="margin-top: 4px;">Need help? Contact support via the HomeCareX app or visit our Help Center.</p>
  </div>
</body>
</html>`;
}

/** Build plain-text summary for native sharing or clipboard fallback */
export function buildPaymentsShareSummary(payments: PaymentRow[], activeFilter?: string): string {
  const filterLabel = (activeFilter || "All").toUpperCase();
  const totalCount = payments.length;
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const formattedPaid = `₹${totalPaid.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const topItems = payments.slice(0, 5).map((p) => {
    const status = p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase();
    return `• ${p.serviceName} (${p.bookingRef}) - ₹${Number(p.amount || 0).toFixed(2)} [${status}]`;
  });

  return [
    `🧾 HomeCareX Payment Statement (${filterLabel})`,
    `📅 Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    `📊 Total Transactions: ${totalCount}`,
    `💰 Total Paid: ${formattedPaid}`,
    "",
    "Recent Transactions:",
    ...topItems,
    payments.length > 5 ? `...and ${payments.length - 5} more transactions.` : "",
    "",
    "View full transaction details and receipts on your HomeCareX account.",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ExportPaymentsMenu({
  payments,
  activeFilter = "",
  variant = "desktop",
  disabled = false,
  className,
  onFetchAll,
}: ExportPaymentsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDisabled = disabled || payments.length === 0;

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const resolvePayments = async (): Promise<PaymentRow[]> => {
    if (onFetchAll) {
      try {
        const all = await onFetchAll();
        if (all && all.length > 0) return all;
      } catch {
        // fallback to provided payments
      }
    }
    return payments;
  };

  const getExportFilename = (ext: string): string => {
    const filterSlug = (activeFilter || "ALL").toUpperCase();
    const today = new Date().toISOString().slice(0, 10);
    return `HomeCareX-Payments-${filterSlug}-${today}.${ext}`;
  };

  // 1. Download CSV
  const handleDownloadCsv = async () => {
    if (isDisabled) return;
    setIsProcessing(true);
    try {
      const records = await resolvePayments();
      const csvString = buildPaymentsCsv(records);
      const filename = getExportFilename("csv");

      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Download / Print PDF Statement
  const handlePrintPdf = async () => {
    if (isDisabled) return;
    setIsProcessing(true);
    try {
      const records = await resolvePayments();
      const html = buildPaymentsStatementHtml(records, activeFilter);

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 350);
      }
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Share Payment History (Web Share + Clipboard Fallback)
  const handleShare = async () => {
    if (isDisabled) return;
    setIsProcessing(true);
    try {
      const records = await resolvePayments();
      const summaryText = buildPaymentsShareSummary(records, activeFilter);
      const filename = getExportFilename("csv");

      // Check for Web Share API
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          const csvString = buildPaymentsCsv(records);
          const csvBlob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
          const csvFile = new File([csvBlob], filename, { type: "text/csv" });

          if (navigator.canShare && navigator.canShare({ files: [csvFile] })) {
            await navigator.share({
              title: "HomeCareX Payment Statement",
              text: summaryText,
              files: [csvFile],
            });
            setIsOpen(false);
            return;
          }

          // Share summary text if files not supported
          await navigator.share({
            title: "HomeCareX Payment Statement",
            text: summaryText,
          });
          setIsOpen(false);
          return;
        } catch (shareErr) {
          if ((shareErr as Error)?.name === "AbortError") {
            // User cancelled the share dialog
            setIsOpen(false);
            return;
          }
          // On other errors, proceed to clipboard fallback
        }
      }

      // Desktop clipboard fallback
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          setIsOpen(false);
        }, 1500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const isMobile = variant === "mobile";

  return (
    <div ref={menuRef} className={clsx("relative inline-block text-left", className)}>
      {isMobile ? (
        /* Mobile pill-shaped button */
        <button
          type="button"
          onClick={() => !isDisabled && setIsOpen((prev) => !prev)}
          disabled={isDisabled || isProcessing}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Export payment statement"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-medium text-indigo-600 shadow-2xs hover:bg-indigo-50 active:scale-95 transition",
            isDisabled && "opacity-50 cursor-not-allowed hover:bg-white active:scale-100",
            FOCUS_RING,
          )}
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Export</span>
        </button>
      ) : (
        /* Desktop dropdown button */
        <button
          type="button"
          onClick={() => !isDisabled && setIsOpen((prev) => !prev)}
          disabled={isDisabled || isProcessing}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Export payments"
          className={clsx(
            "inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-sm font-medium text-indigo-600 shadow-2xs hover:bg-indigo-50 transition-colors",
            isDisabled && "opacity-50 cursor-not-allowed hover:bg-white",
            FOCUS_RING,
          )}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Export</span>
          <ChevronDown
            className={clsx(
              "h-4 w-4 shrink-0 transition-transform duration-200 text-indigo-500",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Export Statement
            </p>
            <p className="text-xs font-medium text-slate-600 mt-0.5 truncate">
              {activeFilter ? `${activeFilter.toUpperCase()} Transactions` : "All Transactions"} ({payments.length})
            </p>
          </div>

          {/* Option 1: CSV */}
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadCsv}
            disabled={isProcessing}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 transition-colors text-left",
              FOCUS_RING,
            )}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="block truncate">Download CSV</span>
              <span className="block text-[11px] text-slate-400 font-normal">Spreadsheet (.csv)</span>
            </div>
          </button>

          {/* Option 2: PDF Statement */}
          <button
            type="button"
            role="menuitem"
            onClick={handlePrintPdf}
            disabled={isProcessing}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 transition-colors text-left",
              FOCUS_RING,
            )}
          >
            <Printer className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="block truncate">Download PDF Statement</span>
              <span className="block text-[11px] text-slate-400 font-normal">Formatted print / PDF</span>
            </div>
          </button>

          {/* Option 3: Share Statement */}
          <button
            type="button"
            role="menuitem"
            onClick={handleShare}
            disabled={isProcessing}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-colors text-left",
              copied
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600",
              FOCUS_RING,
            )}
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 animate-in zoom-in-50" aria-hidden="true" />
            ) : (
              <Share2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <span className={clsx("block truncate font-semibold", copied && "text-emerald-700")}>
                {copied ? "Copied to clipboard!" : "Share Statement"}
              </span>
              <span className="block text-[11px] text-slate-400 font-normal">
                {copied ? "Paste into chat or email" : "Native share / copy summary"}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
