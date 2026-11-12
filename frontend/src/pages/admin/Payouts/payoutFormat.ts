import type { BatchFrequency, PayoutBatch, PayoutRow } from '@/types/payoutBatches';

export const money = (n: number | undefined): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? (n as number) : 0,
  );

export const day = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const periodText = (b: Pick<PayoutBatch, 'periodStart' | 'periodEnd'>): string => {
  // The server stores the end as an exclusive midnight, so show the last day that is actually covered.
  const first = day(b.periodStart);
  const last = day(new Date(new Date(b.periodEnd).getTime() - 1).toISOString());
  return first === last ? first : `${first} – ${last}`;
};

export const apiError = (e: unknown): { status?: number; message: string } => {
  const r = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
  return {
    status: r.response?.status,
    message: r.response?.data?.message || r.message || 'Something went wrong. Please try again.',
  };
};

export const partnerName = (p: PayoutRow['partnerId']): string => (typeof p === 'string' ? p : p.name);

export const FREQUENCY_LABEL: Record<BatchFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

/** Ledger entries are written the moment a batch is confirmed, so a completed batch has nothing left to confirm. */
export const canConfirm = (b: Pick<PayoutBatch, 'status'>): boolean => b.status !== 'completed';