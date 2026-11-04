import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { LedgerRow } from "@/types/earnings";
import { dayFromInstant, inr, monthKey, monthLabel } from "./earningsFormat";

interface Props {
  rows: LedgerRow[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: boolean;
  onMore: () => void;
  busy: boolean;
}

const HAS_OBSERVER = typeof IntersectionObserver !== "undefined";

/**
 * Phone version of the earnings list: one continuous scroll, grouped under month headings.
 * More rows load automatically as the end of the list comes into view (no Prev / Next buttons).
 */
export default function EarningsFeed({ rows, total, hasMore, loadingMore, loadError, onMore, busy }: Props) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef(onMore);
  moreRef.current = onMore;

  // Keep the server's order (newest first) and start a new group whenever the month changes.
  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: LedgerRow[] }[] = [];
    for (const r of rows) {
      const key = monthKey(r.earnedAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, label: monthLabel(key), rows: [r] });
    }
    return out;
  }, [rows]);

  useEffect(() => {
    const el = sentinel.current;
    if (!HAS_OBSERVER || !el || !hasMore || loadingMore || loadError) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) moreRef.current();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // rows.length: re-observe after each batch so a still-visible sentinel loads the next one
  }, [hasMore, loadingMore, loadError, rows.length]);

  return (
    <div className="earn-feed" aria-busy={busy || loadingMore}>
      {groups.map((g) => (
        <section key={g.key} className="earn-month" aria-label={g.label}>
          <h3 className="earn-month-title"><span>{g.label}</span></h3>
          <ul className="earn-month-list">
            {g.rows.map((r) => (
              <li key={r.id} className="earn-feed-item">
                <p className="earn-feed-service">{r.serviceName ?? "Service unavailable"}</p>
                <p className="earn-feed-net">{inr(r.net)}</p>
                <p className="earn-feed-date">{dayFromInstant(r.earnedAt)}</p>
                <p className="earn-feed-status">
                  <span className={`earn-status earn-status--${r.status}`}>{r.status === "settled" ? "Paid out" : "Pending"}</span>
                </p>
                <p className="earn-feed-gross">Gross: {inr(r.gross)}</p>
                <p className="earn-feed-comm">
                  Commission: {inr(r.commission)} ({Math.round(r.commissionRate * 10_000) / 100}%)
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div ref={sentinel} className="earn-feed-end" aria-live="polite">
        {loadingMore && (
          <p className="earn-feed-note"><Loader2 size={16} className="earn-spin" aria-hidden /> Loading more…</p>
        )}
        {loadError && (
          <p className="earn-feed-note">
            Couldn't load more.{" "}
            <button type="button" className="earn-feed-btn" onClick={onMore}>Try again</button>
          </p>
        )}
        {!HAS_OBSERVER && hasMore && !loadingMore && !loadError && (
          <button type="button" className="earn-feed-btn earn-feed-btn--solid" onClick={onMore}>Load more</button>
        )}
        {!hasMore && rows.length > 0 && (
          <p className="earn-feed-note">You're all caught up · {total} {total === 1 ? "earning" : "earnings"}</p>
        )}
      </div>
    </div>
  );
}