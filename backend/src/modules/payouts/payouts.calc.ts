import { businessTzOffsetMinutes, dayBounds, isRealDate, monthStart, parseLocalDate, weekStart } from '../../utils/dates';

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface EarningSlice {
  partnerId: string;
  gross: number;
  commission: number;
  net: number;
}

export interface PartnerTotals extends EarningSlice {
  count: number;
}

/** One total per partner. Sums are accumulated in paise so 0.1 + 0.2 style drift never reaches the payout. */
export function groupEarningsByPartner(earnings: EarningSlice[]): PartnerTotals[] {
  const map = new Map<string, { gross: number; commission: number; net: number; count: number }>();
  for (const e of earnings) {
    const t = map.get(e.partnerId) ?? { gross: 0, commission: 0, net: 0, count: 0 };
    t.gross += Math.round(e.gross * 100);
    t.commission += Math.round(e.commission * 100);
    t.net += Math.round(e.net * 100);
    t.count += 1;
    map.set(e.partnerId, t);
  }
  return [...map.entries()].map(([partnerId, t]) => ({
    partnerId,
    gross: t.gross / 100,
    commission: t.commission / 100,
    net: t.net / 100,
    count: t.count,
  }));
}

/** Batch status follows its payouts: all paid = completed; any paid/processing = processing; any failed = failed. */
export function computeBatchStatus(statuses: PayoutStatus[]): 'pending' | 'processing' | 'completed' | 'failed' {
  if (statuses.length === 0) return 'pending';
  if (statuses.every((s) => s === 'paid')) return 'completed';
  if (statuses.some((s) => s === 'paid' || s === 'processing')) return 'processing';
  if (statuses.some((s) => s === 'failed')) return 'failed';
  return 'pending';
}

export const PAYOUT_FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'] as const;
export type PayoutFrequency = (typeof PAYOUT_FREQUENCIES)[number];

export const isPayoutFrequency = (value: unknown): value is PayoutFrequency =>
  typeof value === 'string' && (PAYOUT_FREQUENCIES as readonly string[]).includes(value);

/** Anchor day for a payout period: "YYYY-MM-DD" in business time, or now when omitted. Returns null if invalid. */
export function parseAnchorDate(ymd: unknown, now: Date = new Date()): Date | null {
  if (ymd === undefined || ymd === null || ymd === '') return now;
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !isRealDate(ymd)) return null;
  return parseLocalDate(ymd);
}

/**
 * [start, end) of the daily / weekly (Mon-Sun) / monthly period that contains `anchor`, in business time (IST).
 * The period containing "today" is allowed, so work finished today can be paid today.
 */
export function resolvePayoutPeriod(
  frequency: Exclude<PayoutFrequency, 'custom'>,
  anchor: Date = new Date(),
  offsetMinutes = businessTzOffsetMinutes(),
): { start: Date; end: Date } {
  if (frequency === 'daily') return dayBounds(anchor, offsetMinutes);
  if (frequency === 'weekly') {
    const start = weekStart(anchor, offsetMinutes);
    return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
  }
  const start = monthStart(anchor, offsetMinutes);
  const local = new Date(anchor.getTime() + offsetMinutes * 60_000);
  const end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - offsetMinutes * 60_000);
  return { start, end };
}
