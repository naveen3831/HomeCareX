import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, CalendarRange, Clock, IndianRupee, Landmark, Wallet } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
import Skeleton from "@/components/common/Skeleton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { earningsApi } from "@/services/earningsApi";
import { payoutsApi } from "@/services/payoutsApi";
import { getWalletSummary } from "@/pages/partner/Wallet/wallet.api";
import type { ApiError } from "@/lib/http";
import type { EarningsSummary } from "@/types/earnings";
import type { PayoutsList } from "@/types/payouts";
import "./EarningsV2.css";
import EarningsHistory from "./EarningsHistory";
import { inr } from "./earningsFormat";

/** Counts up from 0 to `target` once. Skipped if the user prefers reduced motion. */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / durationMs, 1);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function Money({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return (
    <span className={className} aria-label={inr(value)}>
      {inr(Math.round(animated * 100) / 100)}
    </span>
  );
}

function Hero({ data, showPending }: { data: EarningsSummary; showPending: boolean }) {
  return (
    <section className="ex-hero" aria-label="Earnings overview">
      <p className="ex-hero-eyebrow"><Wallet size={15} aria-hidden /> Total earned</p>
      <Money value={data.total} className="ex-hero-value" />
      <p className="ex-hero-note">All time, after commission</p>
      {showPending && data.pending > 0 && (
        <p className="ex-hero-pending"><Clock size={13} aria-hidden /> {inr(data.pending)} pending payout</p>
      )}
    </section>
  );
}

/** Two coloured cards that jump to the Wallet and Payouts pages. A failed lookup just hides the number. */
function Highlights() {
  const wallet = useQuery({ queryKey: ["partner", "wallet", "summary"], queryFn: getWalletSummary, retry: 1 });
  const payouts = useQuery<PayoutsList, ApiError>({ queryKey: ["partner", "payouts", "list"], queryFn: payoutsApi.list, retry: 1 });

  const next = payouts.data?.next ?? null;
  const nextDate = next?.expectedDate
    ? new Date(next.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="ex-highlights">
      <Link to="/partner/wallet" className="ex-hl ex-hl--wallet" aria-label="Open wallet">
        <span className="ex-hl-icon" aria-hidden><Wallet size={18} /></span>
        <span className="ex-hl-label">Wallet</span>
        <strong className="ex-hl-value">{wallet.data ? inr(wallet.data.available) : "—"}</strong>
        <span className="ex-hl-note">
          {wallet.data ? (wallet.data.pending > 0 ? `${inr(wallet.data.pending)} pending` : "Available balance") : "View balance"}
        </span>
        <ArrowUpRight size={16} className="ex-hl-go" aria-hidden />
      </Link>

      <Link to="/partner/payouts" className="ex-hl ex-hl--payout" aria-label="Open payouts">
        <span className="ex-hl-icon" aria-hidden><Landmark size={18} /></span>
        <span className="ex-hl-label">Payouts</span>
        <strong className="ex-hl-value">{next ? inr(next.amount) : payouts.data ? inr(0) : "—"}</strong>
        <span className="ex-hl-note">
          {next ? (nextDate ? `Next payout · ${nextDate}` : "Next payout") : payouts.data ? "No payout due" : "View payouts"}
        </span>
        <ArrowUpRight size={16} className="ex-hl-go" aria-hidden />
      </Link>
    </div>
  );
}

function Periods({ data }: { data: EarningsSummary }) {
  const items = [
    { label: "Today", value: data.today, icon: IndianRupee, tone: "orange" },
    { label: "This week", value: data.week, icon: CalendarDays, tone: "teal" },
    { label: "This month", value: data.month, icon: CalendarRange, tone: "violet" },
  ];
  return (
    <div className="ex-periods" aria-label="Earnings by period">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className={`ex-period ex-period--${tone}`}>
          <span className="ex-period-icon" aria-hidden><Icon size={15} /></span>
          <p>{label}</p>
          <Money value={value} />
        </div>
      ))}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="ex-stack" role="status" aria-label="Loading earnings">
      <Skeleton className="ex-skel ex-skel--hero" />
      <Skeleton className="ex-skel ex-skel--periods" />
      <Skeleton className="ex-skel ex-skel--periods" />
    </div>
  );
}

export default function PartnerEarningsPage() {
  const networkOnline = useOnlineStatus();
  // On desktop each money page shows only its own data; the Wallet / Payouts shortcut cards are for phones.
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const { data, isPending, isError, error, refetch } = useQuery<EarningsSummary, ApiError>({
    queryKey: ["partner", "earnings", "summary"],
    queryFn: earningsApi.getSummary,
    retry: 1,
  });

  let top;
  if (!data && !networkOnline) top = <OfflineState onRetry={() => void refetch()} />;
  else if (isPending) top = <SummarySkeleton />;
  else if (isError || !data) top = <ErrorState message={error?.message} onRetry={() => void refetch()} />;
  else top = (
    <>
      <Hero data={data} showPending={!isDesktop} />
      {!isDesktop && <Highlights />}
      <Periods data={data} />
    </>
  );

  return (
    <div className="ex-page">
      <h1 className="ex-sr-only">Earnings</h1>
      {top}
      {/* History always shows (with an empty state), so the chart, filters and download are never hidden. */}
      <EarningsHistory />
    </div>
  );
}
