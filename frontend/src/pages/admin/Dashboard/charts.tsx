import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FunnelStep, Point } from '@/services/dashboardApi';

/**
 * Admin dashboard charts, built on Recharts (npm i recharts).
 * Every chart sits in <ResponsiveContainer>, so it resizes with the card on phones and desktops.
 * Tooltips work on tap (touch) and hover (mouse) with no extra code.
 */

const BRAND = '#4338ca';
const BRAND_SOFT = '#6366f1';
const GRID = '#e2e8f0';
const AXIS = { fontSize: 11, fill: '#94a3b8' } as const;
const PALETTE = ['#4338ca', '#6366f1', '#818cf8', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#94a3b8'];

type Fmt = (n: number) => string;

/** One shared tooltip look for every chart. */
function ChartTooltip({
  active,
  payload,
  label,
  fmt,
  noun,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: Point }>;
  label?: string;
  fmt: Fmt;
  noun?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0].value ?? 0);
  return (
    <div className="dash-tip" role="status">
      <strong>{fmt(v)}</strong>
      <span>{noun ? `${noun} · ` : ''}{label ?? payload[0].payload?.label}</span>
    </div>
  );
}

/** Show only a few x labels so they never overlap on a 360px screen. */
const tickEvery = (n: number) => Math.max(Math.ceil(n / 5) - 1, 0);

// ---------- Revenue: area chart ----------
export function RevenueChart({ points, fmt, axisFmt }: { points: Point[]; fmt: Fmt; axisFmt: Fmt }) {
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <>
      <p className="dash-total">
        <strong>{fmt(total)}</strong> <span>total revenue</span>
      </p>
      <div className="dash-chart" role="img" aria-label={`Revenue area chart, ${points.length} points`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={tickEvery(points.length)} minTickGap={16} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={axisFmt} tickCount={4} />
            <Tooltip content={<ChartTooltip fmt={fmt} noun="Revenue" />} cursor={{ stroke: '#c7d2fe', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#dashRevenueFill)"
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ---------- Bookings: bar chart ----------
export function BookingsChart({ points, fmt, axisFmt }: { points: Point[]; fmt: Fmt; axisFmt: Fmt }) {
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <>
      <p className="dash-total">
        <strong>{fmt(total)}</strong> <span>total bookings</span>
      </p>
      <div className="dash-chart" role="img" aria-label={`Bookings bar chart, ${points.length} points`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={tickEvery(points.length)} minTickGap={16} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} tickFormatter={axisFmt} tickCount={4} allowDecimals={false} />
            <Tooltip content={<ChartTooltip fmt={fmt} noun="Bookings" />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
            <Bar dataKey="value" fill={BRAND_SOFT} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ---------- Bookings by category: donut + legend ----------
export function CategoryChart({ rows, fmt }: { rows: Point[]; fmt: Fmt }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="dash-donut">
      <div className="dash-donut__plot" role="img" aria-label="Bookings by category donut chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip fmt={fmt} />} />
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {rows.map((r, i) => (
                <Cell key={r.label} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="dash-donut__center" aria-hidden="true">
          <strong>{fmt(total)}</strong>
          <span>bookings</span>
        </div>
      </div>
      <ul className="dash-legend">
        {rows.map((r, i) => (
          <li key={r.label}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{r.label}</span>
            <b>{fmt(r.value)}</b>
            <small>{((r.value / total) * 100).toFixed(0)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Booking funnel: horizontal bars with step conversion ----------
export function FunnelChart({ steps, fmt }: { steps: FunnelStep[]; fmt: Fmt }) {
  const conv = (i: number) => (steps[i - 1].value ? (steps[i].value / steps[i - 1].value) * 100 : 0);
  // The biggest step-to-step drop is the most useful thing to see at a glance.
  let worst = -1;
  for (let i = 1; i < steps.length; i++) if (worst < 0 || conv(i) < conv(worst)) worst = i;

  const data = steps.map((s, i) => ({
    ...s,
    pct: i === 0 ? '' : `${conv(i).toFixed(0)}%`,
    isWorst: i === worst,
  }));
  const height = Math.max(steps.length * 44, 120);

  return (
    <>
      <div className="dash-chart" style={{ height }} role="img" aria-label="Booking funnel chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={96} />
            <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(99,102,241,.06)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false} background={{ fill: '#f1f5f9', radius: 6 }}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={d.isWorst ? '#f59e0b' : PALETTE[Math.min(i, 2)]} />
              ))}
              <LabelList dataKey="value" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: '#0f172a' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {worst > 0 && (
        <p className="dash-funnel__note">
          Biggest drop: {steps[worst - 1].label} → {steps[worst].label} ({(100 - conv(worst)).toFixed(0)}% lost)
        </p>
      )}
    </>
  );
}