import type { MetricKey, TrendPoint } from './performance.types';

interface Props {
  points: TrendPoint[];
  metric: MetricKey;
  label: string;
  max: number;
  format: (v: number) => string;
  /** Current overall value from the summary. */
  current?: number | null;
  /** Goal text, for example "Target 80% or higher". */
  target?: string;
}

const COLORS: Record<MetricKey, string> = {
  rating: '#5b50e6',
  acceptanceRate: '#2b9fd8',
  completionRate: '#168365',
  cancellationRate: '#d44855',
  onTimeRate: '#e0953a',
};

/** Donut size in px. Change SIZE to make the chart bigger or smaller. */
const SIZE = 168;
const STROKE = 18;

function periodLabel(period: string): string {
  const monthly = period.length === 7;
  const date = new Date(monthly ? `${period}-01` : period);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(
    'en-IN',
    monthly ? { month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
}

export default function TrendChart({ points, metric, label, max, format, current = null, target }: Props) {
  const monthly = points
    .filter((p) => p[metric] !== null)
    .map((p) => ({ period: p.period, value: p[metric] as number }));

  const value = current ?? (monthly.length > 0 ? monthly[monthly.length - 1].value : null);

  if (value === null) {
    return (
      <div className="pf-chart-wrap">
        <p className="pf-text">No {label.toLowerCase()} data yet.</p>
      </div>
    );
  }

  const ratio = Math.max(0, Math.min(1, value / max));
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const color = COLORS[metric];

  return (
    <div className="pf-chart-wrap pf-donut-wrap">
      <div className="pf-donut" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${label}: ${format(value)}${max === 5 ? ' out of 5' : ''}`}
        >
          <circle className="pf-donut-track" cx={SIZE / 2} cy={SIZE / 2} r={r} strokeWidth={STROKE} fill="none" />
          <circle
            className="pf-donut-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            strokeWidth={STROKE}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${circ * ratio} ${circ}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="pf-donut-center">
          <span className="pf-donut-value">{format(value)}</span>
          <span className="pf-donut-sub">{max === 5 ? 'out of 5' : label}</span>
        </div>
      </div>

      <div className="pf-donut-info">
        <p className="pf-donut-label">
          <span className="pf-donut-dot" style={{ background: color }} aria-hidden="true" />
          {label}
        </p>
        {target && <p className="pf-donut-target">{target}</p>}

        {monthly.length > 0 && (
          <ul className="pf-donut-months" aria-label={`${label} by month`}>
            {monthly.map((m) => (
              <li key={m.period}>
                <span>{periodLabel(m.period)}</span>
                <strong>{format(m.value)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}