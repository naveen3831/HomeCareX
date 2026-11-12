/** Formatting and date helpers for the Earnings page. Business time is India time (matches the backend default). */
const IST = "Asia/Kolkata";

export const MAX_RANGE_DAYS = 366; // keep in sync with the backend validation

export const inr = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** 1500 -> ₹1.5k, 125000 -> ₹1.25L. For chart axes only. */
export function compactInr(n: number): string {
  if (n >= 10_000_000) return `₹${+(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${+(n / 1_000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

const toUtc = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const todayIst = (): string => new Date().toLocaleDateString("en-CA", { timeZone: IST });

export const addDays = (ymd: string, n: number): string => {
  const dt = toUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

export const mondayOf = (ymd: string): string => addDays(ymd, -((toUtc(ymd).getUTCDay() + 6) % 7));
export const firstOfMonth = (ymd: string): string => `${ymd.slice(0, 8)}01`;
export const daysBetween = (from: string, to: string): number => Math.round((+toUtc(to) - +toUtc(from)) / 86_400_000);

/** "5 Oct" (or "5 Oct 2025" when withYear) from "YYYY-MM-DD". */
export const shortDate = (ymd: string, withYear = false): string =>
  toUtc(ymd).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

/** ISO instant -> "5 Oct 2026" in India time. */
export const dateFromInstant = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });

export type PresetId = "today" | "week" | "month" | "all";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function presetRange(id: PresetId, today = todayIst()): { from?: string; to?: string } {
  switch (id) {
    case "today": return { from: today, to: today };
    case "week": return { from: mondayOf(today), to: today };
    case "month": return { from: firstOfMonth(today), to: today };
    default: return {};
  }
}

export function activePreset(from: string | undefined, to: string | undefined, today = todayIst()): PresetId | null {
  return PRESETS.find((p) => {
    const r = presetRange(p.id, today);
    return r.from === from && r.to === to;
  })?.id ?? null;
}

/** Returns a message when the range can't be sent to the server, else null. */
export function rangeError(from: string | undefined, to: string | undefined): string | null {
  if (from && to && from > to) return "The start date must be on or before the end date.";
  if (from && to && daysBetween(from, to) >= MAX_RANGE_DAYS) return `Pick a range of at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

/** "3 Nov" in India time. */
export const dayFromInstant = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });

/** ISO instant -> "2026-11" in India time (used to group the list by month). */
export const monthKey = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: IST }).slice(0, 7);

/** "2026-11" -> "November 2026". */
export const monthLabel = (key: string): string =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** ISO instant -> "2026-11-04" in India time. */
export const dayKey = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

/** "Today", "Yesterday" or "3 Nov" for a "YYYY-MM-DD" key. */
export function dayLabel(key: string, today = todayIst()): string {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return shortDate(key, key.slice(0, 4) !== today.slice(0, 4));
}

/** ISO instant -> "4:30 pm" in India time. */
export const timeFromInstant = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
