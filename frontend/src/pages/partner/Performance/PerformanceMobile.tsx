import { TARGETS, meetsTarget, type Tip } from './performance.tips';
import type { MetricKey, PerformanceSummary, TrendPoint } from './performance.types';
import './performance.mobile.css';

interface Props {
  summary: PerformanceSummary;
  points: TrendPoint[];
  tips?: Tip[];
}

type RateKey = Exclude<MetricKey, 'rating'>;

interface CardDef {
  key: RateKey;
  label: string;
  goal: string;
}

const CARDS: CardDef[] = [
  { key: 'acceptanceRate', label: 'Acceptance', goal: `Goal ${TARGETS.acceptanceRate}%+` },
  { key: 'completionRate', label: 'Completion', goal: `Goal ${TARGETS.completionRate}%+` },
  { key: 'cancellationRate', label: 'Cancellation', goal: `Goal ${TARGETS.cancellationRate}% or less` },
  { key: 'onTimeRate', label: 'On-time', goal: `Goal ${TARGETS.onTimeRate}%+` },
];

const ALL_KEYS: MetricKey[] = ['rating', 'acceptanceRate', 'completionRate', 'cancellationRate', 'onTimeRate'];

function monthName(period: string): string {
  const monthly = period.length === 7;
  const date = new Date(monthly ? `${period}-01` : period);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
}

/** Change between the two most recent months that have data, or null when there is nothing to compare. */
function changeSince(points: TrendPoint[], key: RateKey): { diff: number; since: string } | null {
  const known = points.filter((p) => p[key] !== null);
  if (known.length < 2) return null;
  const last = known[known.length - 1];
  const prev = known[known.length - 2];
  return { diff: (last[key] as number) - (prev[key] as number), since: monthName(prev.period) };
}

export default function PerformanceMobile({ summary, points }: Props) {
  const { rating } = summary;
  const starFill = rating === null ? 0 : Math.max(0, Math.min(100, (rating / 5) * 100));

  const results = ALL_KEYS.map((k) => meetsTarget(k, summary[k])).filter((r): r is boolean => r !== null);
  const met = results.filter(Boolean).length;
  const allMet = results.length > 0 && met === results.length;
  const targetsText =
    results.length === 0 ? 'Targets appear as data comes in' : allMet ? `All ${results.length} targets met` : `${met} of ${results.length} targets met`;

  return (
    <div className="pm-root">
      <section className="pm-hero" aria-label="Your rating">
        <p className="pm-eyebrow">Your performance</p>
        <div className="pm-rating-row">
          <p className="pm-rating">{rating === null ? '—' : rating.toFixed(1)}</p>
          <div className="pm-rating-side">
            <span className="pm-stars" role="img" aria-label={rating === null ? 'No rating yet' : `Rated ${rating.toFixed(1)} out of 5`}>
              <span className="pm-stars-bg" aria-hidden="true">★★★★★</span>
              <span className="pm-stars-fg" aria-hidden="true" style={{ width: `${starFill}%` }}>★★★★★</span>
            </span>
            <p className="pm-reviews">
              {summary.ratingCount === 0
                ? 'No reviews yet'
                : `${summary.ratingCount} customer review${summary.ratingCount === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <div className="pm-hero-foot">
          <span className={allMet ? 'pm-pill pm-pill-win' : 'pm-pill'}>{targetsText}</span>
          <span className="pm-pill">
            {summary.totalJobs} job{summary.totalJobs === 1 ? '' : 's'} done
          </span>
        </div>
      </section>

      <section aria-labelledby="pm-numbers">
        <h2 id="pm-numbers" className="pm-title">Your numbers</h2>
        <ul className="pm-grid">
          {CARDS.map((c) => {
            const value = summary[c.key];
            const ok = meetsTarget(c.key, value);
            const change = changeSince(points, c.key);
            const rounded = change ? Math.round(change.diff * 10) / 10 : 0;
            const better = change && rounded !== 0 ? (c.key === 'cancellationRate' ? rounded < 0 : rounded > 0) : null;
            return (
              <li key={c.key} className="pm-card">
                <p className="pm-card-label">{c.label}</p>
                <p className="pm-card-value">{value === null ? '—' : `${Math.round(value)}%`}</p>
                {change && (
                  <p className={better === null ? 'pm-delta' : better ? 'pm-delta pm-delta-good' : 'pm-delta pm-delta-bad'}>
                    {rounded === 0 ? `Same as ${change.since}` : `${rounded > 0 ? 'Up' : 'Down'} ${Math.abs(rounded)} pts since ${change.since}`}
                  </p>
                )}
                <div className="pm-bar" aria-hidden="true">
                  <span className={ok === false ? 'pm-bar-low' : ''} style={{ width: `${value === null ? 0 : Math.max(0, Math.min(100, value))}%` }} />
                </div>
                <p className="pm-goal">{c.goal}</p>
                <span className={`pm-chip ${ok === null ? 'pm-chip-none' : ok ? 'pm-chip-ok' : 'pm-chip-low'}`}>
                  {ok === null ? 'No data yet' : ok ? 'On target' : 'Needs attention'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}