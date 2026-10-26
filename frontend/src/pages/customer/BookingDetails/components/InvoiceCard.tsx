import { useState } from "react";
import clsx from "clsx";
import { Download, Loader2, Printer } from "lucide-react";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useInvoice } from "@/hooks/useBooking";
import logoUrl from "@/assets/image.png";

interface Props {
  bookingId: string;
  /** The booking reference shown to the customer. The invoice number is "INV-" plus this. */
  bookingCode: string;
  /** The invoice only exists once the booking is paid. */
  enabled: boolean;
  isCancelled?: boolean;
  className?: string;
}

type Action = "download" | "print";

/** The logo as a data: URI, so the saved .html and the print frame never depend on a URL. Loaded once. */
let logoDataUri: Promise<string> | null = null;
function loadLogo(): Promise<string> {
  if (!logoDataUri) {
    logoDataUri = fetch(logoUrl)
      .then((res) => {
        if (!res.ok) throw new Error("logo not found");
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => {
        logoDataUri = null; // try again next time
        return "";
      });
  }
  return logoDataUri;
}

/** Puts the real logo into the invoice; if it can't be loaded the server's built-in logo stays. */
async function withLogo(html: string): Promise<string> {
  const uri = await loadLogo();
  if (!uri) return html;
  return html.replace(
    /<!--logo-->[\s\S]*?<!--\/logo-->/,
    () => `<img class="logo" src="${uri}" alt="HomeCareX">`,
  );
}

/** Saves the invoice as an .html file the customer can keep or open in any browser. */
function saveHtml(html: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens the browser's print dialog for the invoice ("Save as PDF" is one of its choices).
 * A hidden frame is used instead of a new tab, so a popup blocker can't swallow it after the request.
 */
function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup);
    win.focus();
    win.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
  // Safety net if the browser never fires afterprint.
  window.setTimeout(() => frame.remove(), 120_000);
}

const BUTTON =
  "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The invoice for a paid booking: fetched from GET /bookings/:id/invoice (the server decides who may see it),
 * then downloaded or printed. Shows loading, error and offline states; never leaves the customer guessing.
 */
export default function InvoiceCard({
  bookingId,
  bookingCode,
  enabled,
  isCancelled,
  className,
}: Props) {
  const invoice = useInvoice(bookingId);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const invoiceNo = `INV-${bookingCode}`;
  const busy = invoice.isPending;

  async function run(next: Action) {
    if (busy || !enabled) return;
    setError("");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You're offline. Connect to the internet to get your invoice.");
      return;
    }
    setAction(next);
    try {
      const rawHtml = await invoice.mutateAsync();
      const html = await withLogo(rawHtml);
      const filename = `invoice-${bookingCode.toLowerCase()}.html`;
      if (next === "download") {
        saveHtml(html, filename);
      } else {
        printHtml(html);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      setError(message || "We couldn't get the invoice. Please try again.");
    } finally {
      setAction(null);
    }
  }

  return (
    <div
      className={clsx(
        "rounded-xl border border-line/80 bg-canvas/70 p-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
          Invoice
        </span>
        <span className="font-mono text-xs font-semibold text-ink">
          {invoiceNo}
        </span>
      </div>
      {!enabled && (
        <p className="mt-1 text-xs text-muted">
          {isCancelled
            ? "Invoice is not available as this booking was not completed."
            : "Available once the payment is complete."}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void run("download")}
          disabled={busy || !enabled}
          aria-busy={busy && action === "download"}
          className={clsx(
            BUTTON,
            "bg-brand text-white shadow-sm hover:bg-brand/90",
            FOCUS_RING,
          )}
        >
          {busy && action === "download" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {busy && action === "download"
            ? "Preparing invoice…"
            : "Download Invoice"}
        </button>
        <button
          type="button"
          onClick={() => void run("print")}
          disabled={busy || !enabled}
          aria-busy={busy && action === "print"}
          className={clsx(
            BUTTON,
            "border border-line bg-panel text-ink hover:border-brand/40 hover:bg-panel/80",
            FOCUS_RING,
          )}
        >
          {busy && action === "print" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          )}
          Print / Save PDF
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
