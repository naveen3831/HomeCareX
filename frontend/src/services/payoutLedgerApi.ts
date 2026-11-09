import http from '@/lib/http';
import type { LedgerFrequency, LedgerLinesPage, LedgerReport } from '@/types/payoutLedger';

const clean = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));

/** GET /admin/payout-wallet/ledger: credit / debit report per day or week (read-only). */
export async function fetchPayoutLedger(params: {
  frequency: LedgerFrequency;
  from?: string;
  to?: string;
}): Promise<LedgerReport> {
  const res = await http.get<{ success: boolean; data: LedgerReport }>('/admin/payout-wallet/ledger', {
    params: clean(params),
  });
  return res.data.data;
}

/** GET /admin/payout-wallet/ledger/lines: the individual services behind one period (both days inclusive). */
export async function fetchPayoutLedgerLines(params: {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}): Promise<LedgerLinesPage> {
  const res = await http.get<{
    success: boolean;
    data: LedgerLinesPage['items'];
    meta: { pagination: LedgerLinesPage['pagination'] };
  }>('/admin/payout-wallet/ledger/lines', { params: clean(params) });
  return { items: res.data.data, pagination: res.data.meta.pagination };
}
