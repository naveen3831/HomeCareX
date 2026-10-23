import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Star,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLoad } from "../useLoad";
import { fetchPerformance, fetchTrends } from "./performance.api";
import { TARGETS, buildTips, meetsTarget } from "./performance.tips";
import type {
  MetricKey,
  PerformanceSummary,
  PerformanceTrends,
} from "./performance.types";
import PerformanceMobile from "./PerformanceMobile";
import TrendChart from "./TrendChart";
import "./performance.css";

interface PerformanceData {
  summary: PerformanceSummary;
  trends: PerformanceTrends;
}

interface MetricDef {
  key: MetricKey;
  label: string;
  max: number;
  target: string;
  icon: LucideIcon;
  format: (value: number) => string;
}

const percent = (value: number): string => `${Math.round(value)}%`;

const METRICS: MetricDef[] = [
  {
    key: "rating",
    label: "Rating",
    max: 5,
    target: `Target ${TARGETS.rating} or higher`,
    icon: Star,
    format: (value) => value.toFixed(1),
  },
  {
    key: "acceptanceRate",
    label: "Acceptance",
    max: 100,
    target: `Target ${TARGETS.acceptanceRate}% or higher`,
    icon: ThumbsUp,
    format: percent,
  },
  {
    key: "completionRate",
    label: "Completion",
    max: 100,
    target: `Target ${TARGETS.completionRate}% or higher`,
    icon: CheckCircle2,
    format: percent,
  },
  {
    key: "cancellationRate",
    label: "Cancellation",
    max: 100,
    target: `Target ${TARGETS.cancellationRate}% or lower`,
    icon: Ban,
    format: percent,
  },
  {
    key: "onTimeRate",
    label: "On-time",
    max: 100,
    target: `Target ${TARGETS.onTimeRate}% or higher`,
    icon: Clock,
    format: percent,
  },
];

/** The scorecard must still show when the trends request fails, so trends fall back to an empty list. */
async function loadPerformance(): Promise<PerformanceData> {
  const [summary, trends] = await Promise.all([
    fetchPerformance(),
    fetchTrends().catch((): PerformanceTrends => ({ points: [] })),
  ]);

  return {
    summary,
    trends: { points: Array.isArray(trends?.points) ? trends.points : [] },
  };
}

function Loading() {
  return (
    <div className="pf-page" aria-busy="true">
      <div className="pf-skel" />
      <div className="pf-skel pf-skel-tall" />
      <div className="pf-skel pf-skel-tall" />
    </div>
  );
}

export default function PartnerPerformancePage() {
  const { status, data, error, reload } = useLoad(loadPerformance);
  const online = useOnlineStatus();
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("rating");

  if (status === "loading" && !data) {
    return <Loading />;
  }

  if (!data) {
    return (
      <div className="pf-page">
        <div className="pf-error" role="alert">
          <p>
            {status === "offline"
              ? "You are offline. Your performance will load when you are back online."
              : error?.message || "Could not load your performance."}
          </p>
        </div>
        <div>
          <button type="button" className="pf-btn" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { summary, trends } = data;
  const hasNoData = summary.totalJobs === 0 && summary.rating === null;

  if (hasNoData) {
    return (
      <div className="pf-page">
        <div className="pf-emptycard">
          <span className="pf-empty-icon" aria-hidden="true">
            ★
          </span>
          <p className="pf-empty-title">No performance data yet</p>
          <p className="pf-empty">
            Complete your first job and your rating, acceptance, completion and
            on-time scores will appear here.
          </p>
        </div>
      </div>
    );
  }

  const offlineBanner = !online ? (
    <p className="pf-offline" role="status">
      You are offline. The numbers below may be out of date.
    </p>
  ) : null;

  if (isMobile) {
    return (
      <div className="pf-page">
        {offlineBanner}
        <PerformanceMobile summary={summary} points={trends.points} />
      </div>
    );
  }

  const tips = buildTips(summary);
  const active = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0];

  return (
    <div className="pf-page">
      <header className="pf-page-heading">
        <div className="pf-heading-copy">
          <p className="pf-eyebrow">
            <span className="pf-eyebrow-dot" aria-hidden="true" />
            PERFORMANCE
          </p>
          <h1 className="pf-title">Your performance</h1>
          <p className="pf-sub">
            See how you are doing against the targets and what to improve next.
          </p>
        </div>
      </header>

      {offlineBanner}

      <section className="pf-panel pf-score-section" aria-labelledby="pf-score">
        <div className="pf-section-heading">
          <div>
            <h2 id="pf-score">Scorecard</h2>
            <p>Your overall numbers across all completed work.</p>
          </div>
          <span className="pf-jobs-badge">
            {summary.totalJobs} job{summary.totalJobs === 1 ? "" : "s"}
          </span>
        </div>

        <ul className="pf-strip">
          {METRICS.map((metric, index) => {
            const value = summary[metric.key];
            const ok = meetsTarget(metric.key, value);
            const Icon = metric.icon;
            const tileClass = index === 0 ? "pf-tile" : `pf-tile pf-tile-${index + 1}`;
            const iconClass =
              index === 0 ? "pf-metric-icon" : `pf-metric-icon pf-metric-icon-${index + 1}`;
            const width =
              value === null ? 0 : Math.max(0, Math.min(100, (value / metric.max) * 100));

            return (
              <li key={metric.key} className={tileClass}>
                <div className="pf-tile-top">
                  <span className="pf-k-label">{metric.label}</span>
                  <span className={iconClass} aria-hidden="true">
                    <Icon size={16} />
                  </span>
                </div>

                <p className="pf-k-value">
                  {value === null ? "—" : metric.format(value)}
                </p>
                <p className="pf-muted">
                  {metric.key === "rating"
                    ? summary.ratingCount === 0
                      ? "No reviews yet"
                      : `${summary.ratingCount} review${summary.ratingCount === 1 ? "" : "s"}`
                    : metric.target}
                </p>

                <div className="pf-progress" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </div>

                <span
                  className={`pf-chip ${
                    ok === null ? "pf-chip-none" : ok ? "pf-chip-ok" : "pf-chip-low"
                  }`}
                >
                  <span className="pf-chip-dot" aria-hidden="true" />
                  {ok === null ? "No data yet" : ok ? "On target" : "Needs attention"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="pf-insights-grid">
        <section className="pf-panel pf-trends-panel" aria-labelledby="pf-trends">
          <div className="pf-panel-heading">
            <div>
              <p className="pf-panel-kicker">TRENDS</p>
              <h2 id="pf-trends" className="pf-h2">
                How you are doing
              </h2>
              <p className="pf-panel-sub">Pick a measure to see it month by month.</p>
            </div>
          </div>

          <div className="pf-tabs" role="tablist" aria-label="Performance measure">
            {METRICS.map((metric) => (
              <button
                key={metric.key}
                type="button"
                role="tab"
                aria-selected={metric.key === activeMetric}
                className={`pf-tab${metric.key === activeMetric ? " pf-tab-on" : ""}`}
                onClick={() => setActiveMetric(metric.key)}
              >
                {metric.label}
              </button>
            ))}
          </div>

          <div className="pf-chart-area">
            <TrendChart
              points={trends.points}
              metric={active.key}
              label={active.label}
              max={active.max}
              format={active.format}
              current={summary[active.key]}
              target={active.target}
            />
          </div>
        </section>

        <section className="pf-panel pf-tips-panel" aria-labelledby="pf-tips">
          <div className="pf-panel-heading">
            <div>
              <p className="pf-panel-kicker">IMPROVE</p>
              <h2 id="pf-tips" className="pf-h2">
                Tips for you
              </h2>
              <p className="pf-panel-sub">Based on your current numbers.</p>
            </div>
          </div>

          <ul className="pf-tips">
            {tips.map((tip, index) => (
              <li key={tip.id} className="pf-tip">
                <span className="pf-tip-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="pf-strong">{tip.title}</p>
                  <p className="pf-text">{tip.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export { PartnerPerformancePage };