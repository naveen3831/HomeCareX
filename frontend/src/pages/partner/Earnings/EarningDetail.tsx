import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarDays, Check, CheckCircle2, Clock, Copy, Hash, Wallet } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import { earningsApi } from "@/services/earningsApi";
import type { ApiError } from "@/lib/http";
import type { EarningsLedger, LedgerRow } from "@/types/earnings";
import "./Earnings.css";

/** Always two decimals so money never shows as ₹1,253.6. Returns the parts so the paise can be styled smaller. */
const moneyParts = (n: number): { whole: string; paise: string } => {
  const [whole, paise] = n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(".");
  return { whole, paise };
};
const money = (n: number): string => {
  const { whole, paise } = moneyParts(n);
  return `₹${whole}.${paise}`;
};


const IST = "Asia/Kolkata";

/** "4 Nov 2026, 2:15 pm" in India time. */
const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });

const NOT_FOUND = "NOT_FOUND";

/**
 * There is no "get one earning" endpoint, so when the page is opened without the row (refresh, shared link)
 * the row is looked up in the cached list first, then in the full ledger, newest first.
 */
async function findRow(id: string, cached: LedgerRow | undefined, lists: EarningsLedger[]): Promise<LedgerRow> {
  if (cached) return cached;
  for (const l of lists) {
    const hit = l.items.find((r) => r.id === id);
    if (hit) return hit;
  }
  for (let page = 1; page <= 10; page += 1) {
    const res = await earningsApi.getLedger({ page, limit: 100 });
    const hit = res.items.find((r) => r.id === id);
    if (hit) return hit;
    if (page >= res.pagination.pages) break;
  }
  throw new Error(NOT_FOUND);
}

export default function EarningDetailPage() {
  const { earningId = "" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const fromList = (location.state as { row?: LedgerRow } | null)?.row;
  const stateRow = fromList && fromList.id === earningId ? fromList : undefined;

  const { data: row, isPending, isError, error, refetch } = useQuery<LedgerRow, ApiError | Error>({
    queryKey: ["partner", "earnings", "detail", earningId],
    queryFn: () => {
      const cachedLists: EarningsLedger[] = [];
      for (const [, v] of queryClient.getQueriesData<EarningsLedger | { pages: EarningsLedger[] }>({ queryKey: ["partner", "earnings", "ledger"] })) {
        if (!v) continue;
        if ("pages" in v) cachedLists.push(...v.pages);
        else cachedLists.push(v);
      }
      return findRow(earningId, stateRow, cachedLists);
    },
    initialData: stateRow,
    retry: false,
  });

  const copyBooking = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the id is still visible on screen */
    }
  };

  let body;
  if (isPending) {
    body = <Skeleton className="earn-skel earn-skel--table" />;
  } else if (isError || !row) {
    body =
      error?.message === NOT_FOUND ? (
        <div className="earn-det-card earn-det-missing">
          <p>We couldn't find this earning.</p>
          <Link to="/partner/earnings" className="earn-more">Back to earnings</Link>
        </div>
      ) : (
        <ErrorState message={error?.message} onRetry={() => void refetch()} />
      );
  } else {
    const settled = row.status === "settled";
    const rate = `${Math.round(row.commissionRate * 10_000) / 100}%`;
    const shortId = row.bookingId.slice(-8).toUpperCase();
    const keepPct = row.gross > 0 ? Math.min(100, Math.max(0, (row.net / row.gross) * 100)) : 100;
    const { whole, paise } = moneyParts(row.net);
    body = (
      <>
        <section className={settled ? "earn-det-hero earn-det-hero--ok" : "earn-det-hero"} aria-label="Earning summary">
          <span className="earn-det-pill">
            {settled ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
            {settled ? "Paid out" : "Pending payout"}
          </span>
          <p className="earn-det-kicker">You earned</p>
          <p className="earn-det-amount">
            <span className="earn-det-rupee">{"\u20b9"}</span>
            {whole}
            <span className="earn-det-paise">.{paise}</span>
          </p>
          <p className="earn-det-service">{row.serviceName ?? "Service unavailable"}</p>
          <p className="earn-det-when">{dateTime(row.earnedAt)}</p>

          <ol className="earn-det-steps" aria-label="Payout progress">
            <li className="earn-det-step earn-det-step--done">
              <span className="earn-det-dot"><Check size={12} aria-hidden="true" /></span>
              <span className="earn-det-steplabel">Job completed</span>
            </li>
            <li className={settled ? "earn-det-step earn-det-step--done" : "earn-det-step earn-det-step--now"}>
              <span className="earn-det-dot">{settled ? <Check size={12} aria-hidden="true" /> : <span className="earn-det-pulse" />}</span>
              <span className="earn-det-steplabel">{settled ? "Paid to you" : "Payout on the way"}</span>
            </li>
          </ol>
        </section>

        <section className="earn-det-card" aria-label="Amount breakdown">
          <div className="earn-det-cardhead">
            <h2 className="earn-det-heading">Where the money goes</h2>
            <span className="earn-det-total">{money(row.gross)}</span>
          </div>
          <div className="earn-det-bar" role="img" aria-label={`You keep ${Math.round(keepPct)} percent, commission ${rate}`}>
            <span className="earn-det-bar-keep" style={{ width: `${keepPct}%` }} />
            <span className="earn-det-bar-fee" />
          </div>
          <ul className="earn-det-legend">
            <li>
              <span className="earn-det-swatch earn-det-swatch--keep" />
              <span className="earn-det-legend-label">You keep</span>
              <strong>{money(row.net)}</strong>
            </li>
            <li>
              <span className="earn-det-swatch earn-det-swatch--fee" />
              <span className="earn-det-legend-label">Commission ({rate})</span>
              <strong className="earn-det-minus">{`\u2212 ${money(row.commission)}`}</strong>
            </li>
          </ul>
        </section>

        <section className="earn-det-card earn-det-card--rows" aria-label="Payout details">
          <h2 className="earn-det-heading">Details</h2>
          <ul className="earn-det-rows">
            <li className="earn-det-row">
              <span className="earn-det-ico"><Hash size={16} aria-hidden="true" /></span>
              <span className="earn-det-rowtext"><small>Booking ID</small><b>#{shortId}</b></span>
              <button type="button" className={copied ? "earn-det-copy earn-det-copy--done" : "earn-det-copy"} onClick={() => void copyBooking(row.bookingId)} aria-label="Copy booking ID">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
              </button>
            </li>
            <li className="earn-det-row">
              <span className="earn-det-ico"><CalendarDays size={16} aria-hidden="true" /></span>
              <span className="earn-det-rowtext"><small>Earned on</small><b>{dateTime(row.earnedAt)}</b></span>
            </li>
            <li className="earn-det-row">
              <span className="earn-det-ico">{settled ? <BadgeCheck size={16} aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}</span>
              <span className="earn-det-rowtext">
                <small>{settled ? "Paid out on" : "Payout status"}</small>
                <b>{settled && row.settledAt ? dateTime(row.settledAt) : "Pending"}</b>
              </span>
            </li>
          </ul>
        </section>
      </>
    );
  }

  return (
    <div className="earn-page earn-det">
      <h1 className="earn-sr-only">Earning details</h1>
      {body}
    </div>
  );
}
