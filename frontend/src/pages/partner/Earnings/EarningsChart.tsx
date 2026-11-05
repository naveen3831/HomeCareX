import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LedgerDay } from "@/types/earnings";
import { addDays, compactInr, inr, shortDate } from "./earningsFormat";

export type ChartKind = "bars" | "line";

interface Point {
  label: string;
  title: string;
  value: number;
}

const MAX_DAILY_POINTS = 45;

/** Daily points up to ~6 weeks; longer ranges are summed per 7 days so the chart stays readable. */
function toPoints(series: LedgerDay[]): Point[] {
  if (series.length <= MAX_DAILY_POINTS) {
    return series.map((d) => ({ label: shortDate(d.date), title: shortDate(d.date, true), value: d.net }));
  }
  const out: Point[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    const end = addDays(chunk[0].date, chunk.length - 1);
    out.push({
      label: shortDate(chunk[0].date),
      title: `${shortDate(chunk[0].date)} to ${shortDate(end, true)}`,
      value: chunk.reduce((sum, d) => sum + d.net, 0),
    });
  }
  return out;
}

const PRIMARY = "#4338ca";
const GRID = "#e8e9f5";
const AXIS = "#7a7f9a";

interface TipProps {
  active?: boolean;
  payload?: { payload: Point }[];
}

function Tip({ active, payload }: TipProps) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="ex-tip">
      <span>{p.title}</span>
      <strong>{inr(p.value)}</strong>
    </div>
  );
}

export default function EarningsChart({ series, kind }: { series: LedgerDay[]; kind: ChartKind }) {
  const points = useMemo(() => toPoints(series), [series]);
  const total = points.reduce((sum, p) => sum + p.value, 0);

  if (points.length === 0 || total === 0) {
    // Same height as the real chart, so the page does not jump when earnings arrive.
    return (
      <div className="ex-chart-empty">
        <svg viewBox="0 0 200 60" aria-hidden="true" preserveAspectRatio="none">
          <path d="M0 50 L200 50" stroke={GRID} strokeWidth="2" strokeDasharray="4 4" fill="none" />
        </svg>
        <p>No earnings in this period yet</p>
      </div>
    );
  }

  const axis = { tick: { fontSize: 11, fill: AXIS }, axisLine: false, tickLine: false } as const;
  const common = { data: points, margin: { top: 8, right: 4, bottom: 0, left: 0 } };
  const xAxis = <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={28} />;
  const yAxis = <YAxis {...axis} width={44} tickFormatter={(v: number) => compactInr(v)} />;
  const grid = <CartesianGrid stroke={GRID} vertical={false} />;
  const tip = <Tooltip content={<Tip />} cursor={{ stroke: PRIMARY, strokeOpacity: 0.2 }} />;

  return (
    <div
      className="ex-chart"
      role="img"
      aria-label={`Net earnings, ${points.length} points, ${inr(total)} in total. The list below shows every earning.`}
    >
      <ResponsiveContainer width="100%" height={190}>
        {kind === "bars" ? (
          <BarChart {...common}>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Bar dataKey="value" fill={PRIMARY} radius={[5, 5, 0, 0]} maxBarSize={22} />
          </BarChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="ex-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Area type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} fill="url(#ex-area)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
