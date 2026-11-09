import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronRight, FileText, Inbox, Loader2 } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import { earningsApi } from "@/services/earningsApi";
import type { ApiError } from "@/lib/http";
import type { EarningStatus, EarningsFilters, EarningsLedger } from "@/types/earnings";
import { PRESETS, activePreset, inr, presetRange, rangeError, timeFromInstant, type PresetId } from "./earningsFormat";
import { useAuth } from "@/hooks/useAuth";

const PAGE_SIZE = 10; // rows shown first; each "View more" tap loads the next 10

const STATUS_TABS: { id: EarningStatus | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "settled", label: "Paid out" },
];

export default function EarningsHistory() {
  const [filters, setFilters] = useState<EarningsFilters>(() => presetRange("month"));
  const [custom, setCustom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const invalid = rangeError(filters.from, filters.to);
  const active = activePreset(filters.from, filters.to);

  const feed = useInfiniteQuery<EarningsLedger, ApiError>({
    queryKey: ["partner", "earnings", "ledger", "feed", filters],
    queryFn: ({ pageParam }) => earningsApi.getLedger({ ...filters, page: pageParam as number, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
    enabled: !invalid,
    placeholderData: keepPreviousData, // keep the old rows on screen while a new filter loads
    retry: 1,
  });

  const pages = feed.data?.pages;
  const first = pages?.[0];
  const rows = useMemo(() => pages?.flatMap((p) => p.items) ?? [], [pages]);

  const change = (next: EarningsFilters) => {
    setFilters(next);
    setDownloadError(null);
  };
  const pickPreset = (id: PresetId) => {
    setCustom(false);
    change({ ...presetRange(id), status: filters.status });
  };

  const { user } = useAuth();
  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { buildEarningsStatementPdf } = await import("./earningsStatementPdf");
      const pdf = await buildEarningsStatementPdf(filters, { partnerName: user?.name, partnerPhone: user?.phone });
      pdf.save();
    } catch (e) {
      setDownloadError((e as ApiError)?.message || "Could not create the statement. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const t = first?.totals;
  const total = first?.pagination.total ?? 0;
  const left = Math.max(0, total - rows.length);
  const error = invalid ?? downloadError;
  const canDownload = !!t && t.count > 0 && !invalid;

  const periodName = custom || !active ? "Custom range" : PRESETS.find((p) => p.id === active)?.label ?? "";

  return (
    <section className="ex-history" aria-label="Earnings statement">
      <h2 className="ex-title"><FileText size={18} aria-hidden /> Earnings statement</h2>

      <div className="ex-card ex-filters">
        <div className="ex-chips" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="ex-chip" aria-pressed={active === p.id && !custom} onClick={() => pickPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="ex-subrow">
          <div className="ex-seg" role="group" aria-label="Payout status">
            {STATUS_TABS.map((s) => (
              <button
                key={s.id || "all"}
                type="button"
                aria-pressed={(filters.status ?? "") === s.id}
                onClick={() => change({ ...filters, status: s.id || undefined })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="ex-link" aria-expanded={custom} onClick={() => setCustom((v) => !v)}>
            <CalendarRange size={15} aria-hidden /> Custom
          </button>
        </div>

        {custom && (
          <div className="ex-dates">
            <label>
              <span>From</span>
              <input type="date" value={filters.from ?? ""} max={filters.to || undefined} onChange={(e) => change({ ...filters, from: e.target.value || undefined })} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={filters.to ?? ""} min={filters.from || undefined} onChange={(e) => change({ ...filters, to: e.target.value || undefined })} />
            </label>
          </div>
        )}

        {error && <p className="ex-error" role="alert">{error}</p>}
      </div>

      {!invalid && feed.isPending && (
        <div className="ex-stack" role="status" aria-label="Loading earnings statement">
          <Skeleton className="ex-skel ex-skel--stats" />
          <Skeleton className="ex-skel ex-skel--list" />
        </div>
      )}

      {!invalid && feed.isError && !first && <ErrorState message={feed.error?.message} onRetry={() => void feed.refetch()} />}

      {!invalid && first && t && (
        <>
          <div className="ex-sum" aria-live="polite" aria-busy={feed.isFetching}>
            <span className="ex-sum-label">{periodName} · You earned</span>
            <strong className="ex-sum-value">{inr(t.net)}</strong>
            <div className="ex-sum-grid">
              <div><span>Jobs</span><strong>{t.count}</strong></div>
              <div><span>Gross</span><strong>{inr(t.gross)}</strong></div>
              <div><span>Fees</span><strong>{inr(t.commission)}</strong></div>
            </div>
            <button type="button" className="ex-pdf" onClick={() => void download()} disabled={!canDownload || downloading}>
              {downloading ? <Loader2 size={17} className="ex-spin" aria-hidden /> : <FileText size={17} aria-hidden />}
              {downloading ? "Preparing statement…" : "Download statement (PDF)"}
            </button>
          </div>

          <div className="ex-card ex-list-card" aria-busy={feed.isFetching}>
            <div className="ex-list-head">
              <h3 className="ex-sub">Transactions</h3>
              <span>{total} {total === 1 ? "entry" : "entries"}</span>
            </div>
            {rows.length === 0 ? (
              <div className="ex-empty">
                <span aria-hidden><Inbox size={26} /></span>
                <p>No earnings found</p>
                <small>Try another date range or status. New jobs appear here once they are completed.</small>
              </div>
            ) : (
              <>
                <ul className="ex-tx">
                  {rows.map((r) => {
                    const d = new Date(r.earnedAt);
                    const day = d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" });
                    const mon = d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
                    return (
                      <li key={r.id}>
                        <Link
                          to={`/partner/earnings/${r.id}`}
                          state={{ row: r }}
                          className="ex-tx-row"
                          aria-label={`${r.serviceName ?? "Earning"}, ${inr(r.net)}, open details`}
                        >
                          <span className="ex-tx-date" aria-hidden>
                            <b>{day}</b>
                            <i>{mon}</i>
                          </span>
                          <span className="ex-tx-main">
                            <span className="ex-tx-name">{r.serviceName ?? "Service unavailable"}</span>
                            <span className="ex-tx-meta">{timeFromInstant(r.earnedAt)} · Booking #{r.bookingId.slice(-6).toUpperCase()}</span>
                          </span>
                          <span className="ex-tx-amt">
                            <strong>+{inr(r.net)}</strong>
                            <span className={`ex-tag ex-tag--${r.status}`}>{r.status === "settled" ? "Paid out" : "Pending"}</span>
                          </span>
                          <ChevronRight size={16} className="ex-row-go" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="ex-end" aria-live="polite">
                  {feed.isFetchNextPageError && <p>Couldn't load more. Tap View more to try again.</p>}
                  {feed.hasNextPage ? (
                    <button type="button" className="ex-more" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                      {feed.isFetchingNextPage && <Loader2 size={16} className="ex-spin" aria-hidden />}
                      {feed.isFetchingNextPage ? "Loading" : `View more${left > 0 ? ` (${left} left)` : ""}`}
                    </button>
                  ) : (
                    <p>You're all caught up</p>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
