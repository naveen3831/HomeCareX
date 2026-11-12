import http from '@/lib/http';
import type {
  ConfirmBatchResult,
  GenerateBatchInput,
  PayoutDetails,
  PayoutSummary,
  Pagination,
  PayoutBatch,
  PayoutRow,
} from '@/types/payoutBatches';

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: { pagination?: Pagination };
}

/** GET /admin/payouts: payout batches, newest first. */
export async function fetchPayoutBatches(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: PayoutBatch[]; pagination: Pagination }> {
  const res = await http.get<Envelope<PayoutBatch[]>>('/admin/payouts', {
    params: { ...params, status: params.status || undefined },
  });
  return {
    items: res.data.data,
    pagination: res.data.meta?.pagination ?? {
      page: params.page,
      limit: params.limit,
      total: res.data.data.length,
      pages: 1,
    },
  };
}

/** GET /admin/payout-batches/:id/payouts: one row per partner in the batch. */
export async function fetchBatchPayouts(batchId: string): Promise<PayoutRow[]> {
  const res = await http.get<Envelope<PayoutRow[]>>(
    `/admin/payout-batches/${encodeURIComponent(batchId)}/payouts`,
  );
  return res.data.data;
}

/** POST /admin/payouts: creates a batch from settled earnings. 409 = duplicate or already reserved. */
export async function generatePayoutBatch(input: GenerateBatchInput): Promise<PayoutBatch> {
  const res = await http.post<Envelope<PayoutBatch>>('/admin/payouts', input);
  return res.data.data;
}

/** PATCH /admin/payouts/:id: marks one payout paid and writes the partner wallet ledger entry. */
export async function markPayoutPaid(payoutId: string, transactionId?: string): Promise<PayoutRow> {
  const res = await http.patch<Envelope<PayoutRow>>(
    `/admin/payouts/${encodeURIComponent(payoutId)}`,
    transactionId ? { transactionId } : {},
  );
  return res.data.data;
}

/** GET /admin/payout-batches/:id/export: CSV file of one batch. */
export async function downloadBatchCsv(batchId: string): Promise<void> {
  const res = await http.get<Blob>(`/admin/payout-batches/${encodeURIComponent(batchId)}/export`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payouts-${batchId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** GET /admin/payout-batches/:id: one batch. */
export async function fetchPayoutBatch(batchId: string): Promise<PayoutBatch> {
  const res = await http.get<Envelope<PayoutBatch>>(`/admin/payout-batches/${encodeURIComponent(batchId)}`);
  return res.data.data;
}

/** GET /admin/payout-items/:id/details: the partner's services grouped by day. */
export async function fetchPayoutDetails(payoutId: string): Promise<PayoutDetails> {
  const res = await http.get<Envelope<PayoutDetails>>(`/admin/payout-items/${encodeURIComponent(payoutId)}/details`);
  return res.data.data;
}

/** POST /admin/payout-batches/:id/confirm: pays every unpaid partner in the batch and debits their wallets. */
export async function confirmPayoutBatch(batchId: string): Promise<ConfirmBatchResult> {
  const res = await http.post<Envelope<ConfirmBatchResult>>(
    `/admin/payout-batches/${encodeURIComponent(batchId)}/confirm`,
  );
  return res.data.data;
}

/** GET /admin/payout-batches/summary: the numbers for the cards at the top of Payouts. */
export async function fetchPayoutSummary(): Promise<PayoutSummary> {
  const res = await http.get<Envelope<PayoutSummary>>('/admin/payout-batches/summary');
  return res.data.data;
}

/** Withdrawal requests waiting for an admin decision (shown as a notice on the Payouts page). */
export async function fetchPendingWithdrawalCount(): Promise<number> {
  const res = await http.get<Envelope<{ pendingCount?: number }>>('/admin/withdrawals', {
    params: { page: 1, limit: 1, status: 'pending' },
  });
  return res.data.data.pendingCount ?? 0;
}