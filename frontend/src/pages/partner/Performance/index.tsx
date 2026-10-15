import { useEffect, useState } from 'react';
import { fetchPerformance, fetchTrends, getErrorMessage } from './performance.api';
import { TARGETS, buildTips, meetsTarget } from './performance.tips';
import PerformanceMobile from './PerformanceMobile';
import TrendChart from './TrendChart';
import type { MetricKey, PerformanceSummary, TrendPoint } from './performance.types';
import './performance.css';

type LoadState = 'loading' | 'ready' | 'error';

/** Phones get their own compact layout (PerformanceMobile); everything wider keeps the dashboard. */
const MOBILE_QUERY = '(max-width: 720px)';

interface MetricDef {
  key: MetricKey;
  label: string;
  target: string;
  max: number;
  format: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v)}%`;

const METRICS: MetricDef[] = [
  { key: 'rating', label: 'Overall rating', target: `Target ${TARGETS.rating}+ of 5`, max: 5, format: (v) => v.toFixed(1) },
  { key: 'acceptanceRate', label: 'Acceptance', target: `Target ${TARGETS.acceptanceRate}% or higher`, max: 100, format: pct },
  { key: 'completionRate', label: 'Completion', target: `Target ${TARGETS.completionRate}% or higher`, max: 100, format: pct },
  { key: 'cancellationRate', label: 'Cancellation', target: `Target ${TARGETS.cancellationRate}% or lower`, max: 100, format: pct },
  { key: 'onTimeRate', label: 'On-time', target: `Target ${TARGETS.onTimeRate}% or higher`, max: 100, format: pct },
];

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function PartnerPerformancePage() {
  const online = useOnline();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [trendsError, setTrendsError] = useState('');
  const [metric, setMetric] = useState<MetricKey>('rating');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [s, t] = await Promise.allSettled([fetchPerformance(), fetchTrends()]);
      if (cancelled) return;

      if (s.status === 'rejected') {
        setMessage(
          navigator.onLine
            ? getErrorMessage(s.reason, 'Could not load your performance.')
            : 'You are offline. Check your connection and try again.',
        );
        setState('error');
        return;
      }
      setSummary(s.value);

      if (t.status === 'fulfilled') {
        // keep points in time order so the chart never draws backwards
        setPoints([...(t.value.points ?? [])].sort((a, b) => a.period.localeCompare(b.period)));
        setTrendsError('');
      } else {
        setPoints([]);
        setTrendsError(getErrorMessage(t.reason, 'Could not load trends.'));
      }
      setState('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState('loading');
    setAttempt((n) => n + 1);
  };

  if (state === 'loading') {
    return (
      <div className="pf-page" aria-busy="true" role="status" aria-label="Loading performance">
        <div className="pf-skel pf-skel-tall" />
        <div className="pf-skel" />
        <div className="pf-skel" />
      </div>
    );
  }

  if (state === 'error' || !summary) {
    return (
      <div className="pf-page">
        <div className="pf-emptycard">
          <p className="pf-error" role="alert">
            {message || 'Could not load your performance.'}
          </p>
          <button type="button" className="pf-btn" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const tips = buildTips(summary);
  const hasJobs = summary.totalJobs > 0;
  const showMobile = isMobile && hasJobs;

  return (
    <div className="pf-page">
      {!online && (
        <p className="pf-offline" role="status">
          You are offline. Showing the last loaded data; reload when you reconnect.
        </p>
      )}

      {!showMobile && (
        <header className="pf-page-heading">
          <div className="pf-heading-copy">
            <span className="pf-eyebrow"><span className="pf-eyebrow-dot" /> PARTNER INSIGHTS</span>
            <h1 className="pf-title">Your performance</h1>
            <p className="pf-sub">Track your service quality, progress, and customer experience.</p>
          </div>
          <div className="pf-period">
            <span className="pf-period-icon" aria-hidden="true">↗</span>
            <span><strong>All time</strong><small>{summary.totalJobs} jobs completed</small></span>
          </div>
        </header>
      )}

      {!hasJobs ? (
        <div className="pf-emptycard">
          <div className="pf-empty-icon" aria-hidden="true">↗</div>
          <p className="pf-empty-title">Your scorecard starts here</p>
          <p className="pf-empty">Complete your first job to see your performance, trends, and personalized recommendations.</p>
        </div>
      ) : showMobile ? (
        <PerformanceMobile summary={summary} points={points} tips={tips} />
      ) : (
        <>
          <section className="pf-score-section" aria-labelledby="pf-score-title">
            <div className="pf-section-heading">
              <div>
                <h2 id="pf-score-title">Your scorecard</h2>
                <p>At-a-glance results against your performance targets</p>
              </div>
              <span className="pf-jobs-badge">{summary.totalJobs} total jobs</span>
            </div>
            <ul className="pf-strip">
              {METRICS.map((m, index) => {
                const value = summary[m.key];
                const ok = meetsTarget(m.key, value);
                const progress = value === null ? 0 : Math.max(0, Math.min(100, (value / m.max) * 100));
                return (
                  <li key={m.key} className={`pf-tile pf-tile-${index + 1}`}>
                    <div className="pf-tile-top">
                      <span className="pf-k-label">{m.label}</span>
                      <span className={`pf-metric-icon pf-metric-icon-${index + 1}`} aria-hidden="true">
                        {['★', '↗', '✓', '↘', '◷'][index]}
                      </span>
                    </div>
                    <p className="pf-k-value">{value === null ? '—' : m.format(value)}</p>
                    <p className="pf-muted">
                      {m.key === 'rating'
                        ? `${summary.ratingCount} customer review${summary.ratingCount === 1 ? '' : 's'}`
                        : m.target}
                    </p>
                    <div className="pf-progress" aria-label={value === null ? 'No data' : `${Math.round(progress)}% of scale`}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <span className={`pf-chip ${ok === null ? 'pf-chip-none' : ok ? 'pf-chip-ok' : 'pf-chip-low'}`}>
                      <span className="pf-chip-dot" />
                      {ok === null ? 'No data yet' : ok ? 'On target' : 'Needs attention'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="pf-insights-grid">
            <section className="pf-panel pf-trends-panel">
              <div className="pf-panel-heading">
                <div>
                  <span className="pf-panel-kicker">YOUR PROGRESS</span>
                  <h2 className="pf-h2">Performance trends</h2>
                  <p className="pf-panel-sub">Review how your results have changed over the last 6 months.</p>
                </div>
                <span className="pf-chart-mark" aria-hidden="true">⌁</span>
              </div>
              <div className="pf-tabs" role="group" aria-label="Trend metric">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={m.key === metric ? 'pf-tab pf-tab-on' : 'pf-tab'}
                    aria-pressed={m.key === metric}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="pf-chart-area">
                {trendsError ? (
                  <p className="pf-error" role="alert">{trendsError}</p>
                ) : (
                  <TrendChart
                    points={points}
                    metric={active.key}
                    label={active.label}
                    max={active.max}
                    format={active.format}
                    current={summary[active.key]}
                    target={active.target}
                  />
                )}
              </div>
            </section>

            <aside className="pf-panel pf-tips-panel">
              <div className="pf-panel-heading">
                <div>
                  <span className="pf-panel-kicker">NEXT BEST ACTIONS</span>
                  <h2 className="pf-h2">How to improve</h2>
                  <p className="pf-panel-sub">Small steps that help build customer trust.</p>
                </div>
                <span className="pf-tips-mark" aria-hidden="true">✦</span>
              </div>
              <ul className="pf-tips">
                {tips.map((t, index) => (
                  <li key={t.id} className="pf-tip">
                    <span className="pf-tip-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="pf-strong">{t.title}</p>
                      <p className="pf-text">{t.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pf-tip-footer">
                <span className="pf-tip-footer-icon" aria-hidden="true">i</span>
                <p>Your scorecard updates as new job and review data becomes available.</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}