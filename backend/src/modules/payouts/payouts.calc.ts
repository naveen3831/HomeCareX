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
