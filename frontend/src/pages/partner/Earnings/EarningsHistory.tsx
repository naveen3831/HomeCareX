import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, CheckCircle2, ChevronRight, Clock, Download, Inbox, Loader2, TrendingUp } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import { earningsApi } from "@/services/earningsApi";
import type { ApiError } from "@/lib/http";
import type { EarningStatus, EarningsFilters, EarningsLedger, LedgerRow } from "@/types/earnings";
import EarningsChart, { type ChartKind } from "./EarningsChart";
import { PRESETS, activePreset, dayKey, dayLabel, inr, presetRange, rangeError, timeFromInstant, type PresetId } from "./earningsFormat";

const PAGE_SIZE = 10; // rows shown first; each "View more" tap loads the next 10

const STATUS_TABS: { id: EarningStatus | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "settled", label: "Paid out" },
];

/** Hands the CSV to the browser's normal download flow. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function EarningsHistory() {
  const [filters, setFilters] = useState<EarningsFilters>(() => presetRange("month"));
  const [custom, setCustom] = useState(false);
  const [kind, setKind] = useState<ChartKind>("bars");
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

  const groups = useMemo(() => {
    const out: { key: string; rows: LedgerRow[] }[] = [];
    for (const r of rows) {
      const key = dayKey(r.earnedAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, rows: [r] });
    }
    return out;
  }, [rows]);

  const change = (next: EarningsFilters) => {
    setFilters(next);
    setDownloadError(null);
  };
  const pickPreset = (id: PresetId) => {
    setCustom(false);
    change({ ...presetRange(id), status: filters.status });
  };

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await earningsApi.exportCsv(filters);
      saveBlob(blob, filename);
    } catch (e) {
      setDownloadError((e as ApiError).message || "Could not download the file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const t = first?.totals;
  const total = first?.pagination.total ?? 0;
  const left = Math.max(0, total - rows.length);
  const error = invalid ?? downloadError;
  const canDownload = !!t && t.count > 0 && !invalid;

  return (
    <section className="ex-history" aria-label="Earnings history">
      {/* Filters: four quick ranges on one line, then status and custom dates */}
      <div className="ex-card ex-filters">
        <div className="ex-card-head">
          <h2 className="ex-title"><TrendingUp size={17} aria-hidden /> Earnings history</h2>
          <button type="button" className="ex-download" onClick={() => void download()} disabled={!canDownload || downloading}>
            {downloading ? <Loader2 size={15} className="ex-spin" aria-hidden /> : <Download size={15} aria-hidden />}
            {downloading ? "Preparing" : "Download CSV"}
          </button>
        </div>

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
        <div className="ex-stack" role="status" aria-label="Loading earnings history">
          <Skeleton className="ex-skel ex-skel--stats" />
          <Skeleton className="ex-skel ex-skel--chart" />
          <Skeleton className="ex-skel ex-skel--list" />
        </div>
      )}

      {!invalid && feed.isError && !first && <ErrorState message={feed.error?.message} onRetry={() => void feed.refetch()} />}

      {!invalid && first && t && (
        <>
          <div className="ex-stats" aria-live="polite" aria-busy={feed.isFetching}>
            <div><span>Jobs</span><strong>{t.count}</strong></div>
            <div><span>Gross</span><strong>{inr(t.gross)}</strong></div>
            <div><span>Fees</span><strong>{inr(t.commission)}</strong></div>
            <div className="ex-stats-net"><span>You earned</span><strong>{inr(t.net)}</strong></div>
          </div>

          <div className="ex-card">
            <div className="ex-card-head">
              <h3 className="ex-sub"><BarChart3 size={16} aria-hidden /> Trend</h3>
              <div className="ex-seg ex-seg--sm" role="group" aria-label="Chart type">
                <button type="button" aria-pressed={kind === "bars"} onClick={() => setKind("bars")}>Bars</button>
                <button type="button" aria-pressed={kind === "line"} onClick={() => setKind("line")}>Line</button>
              </div>
            </div>
            <EarningsChart series={first.series} kind={kind} />
          </div>

          <div className="ex-card ex-list-card" aria-busy={feed.isFetching}>
            <h3 className="ex-sub">All earnings</h3>
            {rows.length === 0 ? (
              <div className="ex-empty">
                <span aria-hidden><Inbox size={26} /></span>
                <p>No earnings found</p>
                <small>Try another date range or status. New jobs appear here once they are completed.</small>
              </div>
            ) : (
              <>
                {groups.map((g) => (
                  <div key={g.key} className="ex-day">
                    <h4>{dayLabel(g.key)}</h4>
                    <ul>
                      {g.rows.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={`/partner/earnings/${r.id}`}
                            state={{ row: r }}
                            className="ex-row"
                            aria-label={`${r.serviceName ?? "Earning"}, ${inr(r.net)}, open details`}
                          >
                            <span className={`ex-row-icon ex-row-icon--${r.status}`} aria-hidden>
                              {r.status === "settled" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                            </span>
                            <span className="ex-row-main">
                              <span className="ex-row-name">{r.serviceName ?? "Service unavailable"}</span>
                              <span className="ex-row-meta">
                                {timeFromInstant(r.earnedAt)} · {r.status === "settled" ? "Paid out" : "Pending payout"}
                              </span>
                            </span>
                            <span className="ex-row-amt">
                              <strong>+{inr(r.net)}</strong>
                              <small>Fee {inr(r.commission)}</small>
                            </span>
                            <ChevronRight size={16} className="ex-row-go" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="ex-end" aria-live="polite">
                  {feed.isFetchNextPageError && <p>Couldn't load more. Tap View more to try again.</p>}
                  {feed.hasNextPage ? (
                    <button type="button" className="ex-more" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                      {feed.isFetchingNextPage && <Loader2 size={16} className="ex-spin" aria-hidden />}
                      {feed.isFetchingNextPage ? "Loading" : `View more${left > 0 ? ` (${left} left)` : ""}`}
                    </button>
                  ) : (
                    <p>You're all caught up · {total} {total === 1 ? "earning" : "earnings"}</p>
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
