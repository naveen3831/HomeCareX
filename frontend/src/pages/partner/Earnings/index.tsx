import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, CalendarRange, IndianRupee, Wallet } from "lucide-react";
import ErrorState from "@/components/common/ErrorState";
import EarningsTabs from "@/components/partner/EarningsTabs";
import OfflineState from "@/components/common/OfflineState";
import Skeleton from "@/components/common/Skeleton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { earningsApi } from "@/services/earningsApi";
import type { ApiError } from "@/lib/http";
import type { EarningsSummary } from "@/types/earnings";
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

function Hero({ data }: { data: EarningsSummary }) {
  return (
    <section className="ex-hero" aria-label="Earnings overview">
      <p className="ex-hero-eyebrow"><Wallet size={15} aria-hidden /> Total earned</p>
      <Money value={data.total} className="ex-hero-value" />
      <p className="ex-hero-note">All time, after commission</p>

      <Link to="/partner/wallet" className="ex-hero-link">
        View wallet balance <ArrowUpRight size={15} aria-hidden />
      </Link>
    </section>
  );
}

function Periods({ data }: { data: EarningsSummary }) {
  const items = [
    { label: "Today", value: data.today, icon: IndianRupee },
    { label: "This week", value: data.week, icon: CalendarDays },
    { label: "This month", value: data.month, icon: CalendarRange },
  ];
  return (
    <div className="ex-periods" aria-label="Earnings by period">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="ex-period">
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
    </div>
  );
}

export default function PartnerEarningsPage() {
  const networkOnline = useOnlineStatus();
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
      <Hero data={data} />
      <Periods data={data} />
    </>
  );

  return (
    <div className="ex-page">
      <EarningsTabs />
      <h1 className="ex-sr-only">Earnings</h1>
      {top}
      {/* History always shows (with an empty state), so the chart, filters and download are never hidden. */}
      <EarningsHistory />
    </div>
  );
}
