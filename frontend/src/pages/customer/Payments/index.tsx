import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import {
  Banknote,
  Car,
  ChevronDown,
  CreditCard,
  FileText,
  Filter,
  Landmark,
  Smartphone,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { ExportPaymentsMenu, ReceiptDialog, StatusPill } from "@/components/customer/payments";
import { formatMoney, methodLabel, usePayments } from "@/features/payments";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { customerPath } from "@/routes/customerPath";
import { paymentApi } from "@/services/paymentApi";
import type { PaymentRecordStatus, PaymentRow } from "@/types/payment";

const FILTERS: { value: "" | PaymentRecordStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const METHOD_ICON: Record<string, typeof CreditCard> = {
  card: CreditCard,
  upi: Smartphone,
  netbanking: Landmark,
  wallet: Wallet,
  cod: Banknote,
};

/** Desktop table method cell with icon matching original implementation */
function MethodCell({ method }: { method: PaymentRow["method"] }) {
  const Icon = method ? METHOD_ICON[method] : undefined;
  if (!method) return <span className="text-muted">{methodLabel(method)}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-ink">
      {Icon && (
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      )}
      <span className="min-w-0 break-words xl:whitespace-nowrap">
        {methodLabel(method)}
      </span>
    </span>
  );
}

/** Desktop receipt button */
function ReceiptButton({
  row,
  onOpen,
  touch = false,
}: {
  row: PaymentRow;
  onOpen: (row: PaymentRow) => void;
  touch?: boolean;
}) {
  if (!row.receiptNo)
    return (
      <span className="text-xs text-muted">
        {row.method === "cod" ? "On service" : "—"}
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-brand shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-soft ${
        touch ? "min-h-[44px] w-full" : "h-9"
      } ${FOCUS_RING}`}
    >
      <FileText className="h-4 w-4" aria-hidden="true" />
      Receipt
      <span className="sr-only"> for {row.bookingRef}</span>
    </button>
  );
}

/** Amount with tabular numbers */
function Amount({ value }: { value: number; stacked?: boolean }) {
  const raw = formatMoney(value);
  const m = raw.match(/^(\D*?)([\d,]+)(\.\d+)?$/);
  if (!m) return <span className="block text-left tabular-nums">{raw}</span>;
  const [, symbol, whole, dec] = m;
  return (
    <span
      className="block whitespace-nowrap text-left tabular-nums"
      style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
    >
      <span className="font-semibold text-ink">
        {symbol}
        {whole}
      </span>
      {dec && <span className="font-medium text-muted">{dec}</span>}
    </span>
  );
}

const TH =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted";

function getServiceIcon(serviceName?: string) {
  const s = (serviceName || "").toLowerCase();
  if (s.includes("car") || s.includes("auto") || s.includes("vehicle") || s.includes("wash")) {
    return Car;
  }
  if (
    s.includes("clean") ||
    s.includes("pest") ||
    s.includes("paint") ||
    s.includes("maid") ||
    s.includes("home")
  ) {
    return Sparkles;
  }
  return Wrench;
}

export default function Payments() {
  const online = useOnlineStatus();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [receiptRow, setReceiptRow] = useState<PaymentRow | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Cache originating entry point (e.g. Profile or Dashboard) so returning from Booking Details
  // preserves original navigation destination and avoids history loops.
  useEffect(() => {
    const fromCandidate =
      (location.state as { origin?: string; from?: string })?.origin ||
      (location.state as { origin?: string; from?: string })?.from;
    if (
      fromCandidate &&
      !fromCandidate.includes("/bookings") &&
      !fromCandidate.includes("/payments")
    ) {
      try {
        sessionStorage.setItem("payments_origin", fromCandidate);
      } catch {
        // ignore
      }
    }
  }, [location.state]);

  const paymentsOrigin =
    (location.state as { origin?: string; from?: string })?.origin ||
    (location.state as { origin?: string; from?: string })?.from ||
    (() => {
      try {
        const saved = sessionStorage.getItem("payments_origin");
        return saved && !saved.includes("/bookings") && !saved.includes("/payments")
          ? saved
          : null;
      } catch {
        return null;
      }
    })() ||
    customerPath("/profile");

  const urlStatus = (searchParams.get("status") || "").toUpperCase();
  const validUrlStatus = (["PAID", "PENDING", "FAILED", "REFUNDED"].includes(urlStatus)
    ? urlStatus
    : "") as "" | PaymentRecordStatus;

  const [status, setStatusState] = useState<"" | PaymentRecordStatus>(() => {
    if (validUrlStatus) return validUrlStatus;
    try {
      const saved = sessionStorage.getItem("payments_status");
      if (saved && ["PAID", "PENDING", "FAILED", "REFUNDED"].includes(saved)) {
        return saved as PaymentRecordStatus;
      }
    } catch {
      // ignore
    }
    return "";
  });

  const setStatus = (newStatus: "" | PaymentRecordStatus) => {
    setStatusState(newStatus);
    setPage(1);
    try {
      if (newStatus) {
        sessionStorage.setItem("payments_status", newStatus);
      } else {
        sessionStorage.removeItem("payments_status");
      }
    } catch {
      // ignore
    }
    const nextParams = new URLSearchParams(searchParams);
    if (newStatus) {
      nextParams.set("status", newStatus);
    } else {
      nextParams.delete("status");
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (validUrlStatus !== status) {
      setStatusState(validUrlStatus);
    }
  }, [validUrlStatus]);

  const { data, isLoading, isError, error, refetch, isFetching } = usePayments(
    page,
    status || undefined,
  );

  // Restore scroll position when returning from Booking Details
  useEffect(() => {
    try {
      const savedScroll = sessionStorage.getItem("payments_scroll_pos");
      if (savedScroll && data?.items && data.items.length > 0) {
        sessionStorage.removeItem("payments_scroll_pos");
        const y = parseInt(savedScroll, 10);
        if (!isNaN(y) && y > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "instant" });
          });
        }
      }
    } catch {
      // ignore
    }
  }, [data?.items]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // Locate Mobile TopBar custom action slot in DOM
  const [mobilePortalEl, setMobilePortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMobilePortalEl(document.getElementById("topbar-mobile-action"));
  }, []);

  const handleFetchAllPayments = async (): Promise<PaymentRow[]> => {
    if (!data) return [];
    if (data.items.length >= data.total) return data.items;
    const res = await paymentApi.list({
      page: 1,
      limit: Math.max(data.total, 100),
      ...(status ? { status } : {}),
    });
    return res.items;
  };

  const mobileExportElement = (
    <ExportPaymentsMenu
      payments={data?.items ?? []}
      activeFilter={status}
      variant="mobile"
      disabled={isLoading || (data?.items?.length ?? 0) === 0}
      onFetchAll={handleFetchAllPayments}
    />
  );

  /* Shared empty / error / loading elements */
  const renderEmptyState = () => (
    <EmptyState
      title={status ? "No payments match this filter" : "No payments yet"}
      description={
        status
          ? "Try a different status filter."
          : "Your payments and receipts will show up here after your first booking."
      }
      action={
        status ? (
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className={clsx(
              "inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-brand/90 transition active:scale-95",
              FOCUS_RING,
            )}
          >
            Show all payments
          </button>
        ) : (
          <Link
            to={customerPath("/services")}
            className={clsx(
              "inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-brand/90 transition active:scale-95",
              FOCUS_RING,
            )}
          >
            Browse services
          </Link>
        )
      }
    />
  );

  const renderErrorState = () =>
    !online ? (
      <OfflineState onRetry={() => void refetch()} />
    ) : (
      <ErrorState
        title="Couldn't load your payments"
        message={error?.message}
        onRetry={() => void refetch()}
      />
    );

  return (
    <>
      {/* =========================================================================
          DESKTOP / WEB VIEW (md and up: 768px, 1024px, 1280px, 1440px)
          Restored to exact previous table layout and styling matching screenshot.
          ========================================================================= */}
      <div className="hidden md:block">
        <div className="w-full min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <h1 className="text-xl font-bold text-ink">Payments</h1>
          <p className="mt-1 text-sm text-muted">
            Every payment for your bookings, with receipts.
          </p>

          {/* Desktop Toolbar: Filter by status dropdown on left, Export menu on right */}
          <div className="mb-4 mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="payments-status-desktop"
                className="inline-flex items-center gap-1.5 text-sm text-muted"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                Status
              </label>
              <div className="relative w-44">
                <select
                  id="payments-status-desktop"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as "" | PaymentRecordStatus);
                  }}
                  className={`min-h-[40px] w-full appearance-none rounded-lg border border-line bg-white py-0 pl-3 pr-9 text-sm font-medium text-ink shadow-sm hover:border-brand/40 ${FOCUS_RING}`}
                >
                  {FILTERS.map((f) => (
                    <option key={f.value || "all"} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Desktop Export Menu */}
            <ExportPaymentsMenu
              payments={data?.items ?? []}
              activeFilter={status}
              variant="desktop"
              disabled={isLoading || (data?.items?.length ?? 0) === 0}
              onFetchAll={handleFetchAllPayments}
            />
          </div>

          {/* Desktop Table Content */}
          {isLoading ? (
            <LoadingState label="Loading your payments…" />
          ) : isError || !data ? (
            renderErrorState()
          ) : data.items.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-line bg-panel">
                <table className="w-full min-w-[700px] table-fixed text-left text-sm">
                  <caption className="sr-only">Your payments</caption>
                  <thead className="border-b border-line bg-canvas">
                    <tr>
                      <th scope="col" className={`w-[12%] ${TH}`}>
                        Transaction
                      </th>
                      <th scope="col" className={TH}>
                        Booking
                      </th>
                      <th scope="col" className={`w-[12%] ${TH}`}>
                        Date
                      </th>
                      <th scope="col" className={`w-[13%] ${TH}`}>
                        Amount
                      </th>
                      <th scope="col" className={`w-[17%] ${TH} pl-8`}>
                        Method
                      </th>
                      <th scope="col" className={`w-[11%] ${TH}`}>
                        Status
                      </th>
                      <th scope="col" className={`w-[12%] ${TH}`}>
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((p) => {
                      const bookingTarget = p.bookingId
                        ? customerPath(`/bookings/${p.bookingId}`)
                        : customerPath("/bookings");
                      const paymentsUrl = `${customerPath("/payments")}${status ? `?status=${status}` : ""}`;

                      return (
                        <tr
                          key={p.id}
                          className="transition-colors hover:bg-canvas/70"
                        >
                          <td
                            className="truncate px-4 py-3.5 font-mono text-xs text-muted"
                            title={p.id}
                          >
                            {p.id.slice(-8).toUpperCase()}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              to={bookingTarget}
                              state={{ from: paymentsUrl, origin: paymentsOrigin }}
                              className="group/b block transition-colors"
                            >
                              <span className="block break-words font-medium text-ink group-hover/b:text-brand">
                                {p.serviceName}
                              </span>
                              <span className="text-xs text-muted group-hover/b:underline">
                                {p.bookingRef}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-muted">
                            {fmtDate(p.paidAt ?? p.createdAt)}
                          </td>
                          <td className="py-3.5 pl-4 pr-4 text-sm">
                            <Amount value={p.amount} />
                          </td>
                          <td className="px-4 py-3.5">
                            <MethodCell method={p.method} />
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusPill status={p.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <ReceiptButton row={p} onOpen={setReceiptRow} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Desktop Pagination */}
              {totalPages > 1 && (
                <nav
                  aria-label="Payments pages"
                  className="mt-4 flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-muted" aria-live="polite">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.max(1, n - 1))}
                      disabled={page <= 1 || isFetching}
                      className={`min-h-[44px] rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px] ${FOCUS_RING}`}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                      disabled={page >= totalPages || isFetching}
                      className={`min-h-[44px] rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px] ${FOCUS_RING}`}
                    >
                      Next
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Portalled Mobile Export Button into TopBar header right action slot */}
      {mobilePortalEl && createPortal(mobileExportElement, mobilePortalEl)}

      {/* =========================================================================
          MOBILE VIEW (below md: 320px, 375px, 390px, 414px)
          Compact cards, horizontal status pills, bottom nav clearance.
          ========================================================================= */}
      <div className="mx-auto w-full max-w-xl space-y-3.5 pb-28 sm:pb-12 md:hidden">
        {/* Fallback mobile export button if TopBar portal target is not in DOM */}
        {!mobilePortalEl && (
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-lg font-bold text-ink">Payments</h2>
            {mobileExportElement}
          </div>
        )}

        {/* 1. Top Header Information Banner */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-[#e5e0fb] bg-gradient-to-br from-[#f0eeff] via-[#f4f2ff] to-[#edf0ff] p-4 shadow-2xs">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5046e5] text-white shadow-xs"
            aria-hidden="true"
          >
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-snug">
            Every payment for your bookings, with receipts.
          </p>
        </div>

        {/* 2. Horizontal Filter Tabs: All, Paid, Pending, Failed, Refunded */}
        <div
          role="tablist"
          aria-label="Payment status filter"
          className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value || "all"}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setStatus(f.value);
                }}
                className={clsx(
                  "inline-flex shrink-0 items-center justify-center rounded-full px-5 py-2 text-xs font-semibold transition-all select-none active:scale-95",
                  active
                    ? "bg-[#5046e5] text-white shadow-xs"
                    : "border border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  FOCUS_RING,
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 3. Payment Cards Content */}
        {isLoading ? (
          <LoadingState label="Loading your payments…" />
        ) : isError || !data ? (
          renderErrorState()
        ) : data.items.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-3">
            {/* Compact Clickable Payment Cards List */}
            <ul className="space-y-3" aria-label="Payments list">
              {data.items.map((p) => {
                const ServiceIcon = getServiceIcon(p.serviceName);
                const bookingTarget = p.bookingId
                  ? customerPath(`/bookings/${p.bookingId}`)
                  : customerPath("/bookings");
                const paymentsUrl = `${customerPath("/payments")}${status ? `?status=${status}` : ""}`;

                return (
                  <li key={p.id}>
                    <Link
                      to={bookingTarget}
                      state={{ from: paymentsUrl, origin: paymentsOrigin }}
                      onClick={() => {
                        try {
                          sessionStorage.setItem("payments_scroll_pos", String(window.scrollY));
                          sessionStorage.setItem("payments_status", status);
                        } catch {
                          // ignore
                        }
                      }}
                      className={clsx(
                        "group flex items-center justify-between gap-3 rounded-[20px] border border-slate-100 bg-white p-3.5 sm:p-4 shadow-2xs transition-all hover:border-slate-200 hover:shadow-xs active:scale-[0.99]",
                        FOCUS_RING,
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0eeff] text-[#5046e5] transition-colors group-hover:bg-[#e7e3fc]"
                          aria-hidden="true"
                        >
                          <ServiceIcon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-[#5046e5] transition-colors">
                            {p.serviceName}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.bookingRef}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="block text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                            {formatMoney(p.amount)}
                          </span>
                          <div className="mt-1 flex justify-end">
                            <span
                              className={clsx(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                p.status === "PAID" && "bg-[#dcfce7] text-[#15803d]",
                                p.status === "PENDING" && "bg-[#ffedd5] text-[#c2410c]",
                                p.status === "FAILED" && "bg-[#fee2e2] text-[#dc2626]",
                                p.status === "REFUNDED" && "bg-[#ede9fe] text-[#7c3aed]",
                              )}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-current"
                                aria-hidden="true"
                              />
                              {p.status === "PAID"
                                ? "Paid"
                                : p.status === "PENDING"
                                  ? "Pending"
                                  : p.status === "FAILED"
                                    ? "Failed"
                                    : "Refunded"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Payments pages"
                className="mt-4 flex items-center justify-between gap-3 pt-2"
              >
                <span className="text-xs text-slate-500" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    disabled={page <= 1 || isFetching}
                    className={clsx(
                      "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
                      FOCUS_RING,
                    )}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                    disabled={page >= totalPages || isFetching}
                    className={clsx(
                      "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
                      FOCUS_RING,
                    )}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* Shared Receipt Dialog */}
      {receiptRow && (
        <ReceiptDialog row={receiptRow} onClose={() => setReceiptRow(null)} />
      )}
    </>
  );
}
