export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type BatchFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface PayoutBatch {
  _id: string;
  frequency?: BatchFrequency;
  periodStart: string;
  periodEnd: string;
  gross: number;
  commission: number;
  net: number;
  status: BatchStatus;
  createdAt?: string;
}

export interface PayoutRow {
  _id: string;
  partnerId: { _id: string; name: string; email?: string } | string;
  batchId: string;
  gross?: number;
  commission?: number;
  amount: number;
  servicesCount?: number;
  status: PayoutStatus;
  method?: string | null;
  transactionId?: string | null;
  paidAt: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface GenerateBatchInput {
  frequency: BatchFrequency;
  /** YYYY-MM-DD, for daily / weekly / monthly. */
  date?: string;
  /** YYYY-MM-DD, for custom. */
  periodStart?: string;
  periodEnd?: string;
}

export interface PayoutServiceLine {
  earningId: string;
  bookingId: string;
  serviceName: string;
  gross: number;
  commission: number;
  net: number;
  earnedAt: string;
}

export interface PayoutDay {
  date: string;
  servicesCount: number;
  gross: number;
  commission: number;
  net: number;
  services: PayoutServiceLine[];
}

/** GET /admin/payout-items/:id/details: one partner's payout with the services grouped by day. */
export interface PayoutDetails {
  payout: {
    id: string;
    batchId: string;
    status: PayoutStatus;
    method: string | null;
    transactionId: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  partner: { id: string; name: string; email: string };
  days: PayoutDay[];
  totals: { servicesCount: number; gross: number; commission: number; net: number };
}

export interface ConfirmBatchResult {
  batch: PayoutBatch;
  confirmedCount: number;
  confirmedAmount: number;
  failed: { payoutId: string; message: string }[];
}

/** GET /admin/payout-batches/summary: totals across all batches (failed excluded). */
export interface PayoutSummary {
  batches: number;
  gross: number;
  commission: number;
  net: number;
  paid: number;
  awaiting: number;
}