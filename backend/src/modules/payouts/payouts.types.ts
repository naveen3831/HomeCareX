import type { PayoutStatus } from './payouts.calc';
import type { PayoutBatchStatus } from './payouts.constants';

export type { PayoutStatus };

/**
 * Status of a payout batch.
 */
export type { PayoutBatchStatus };

/**
 * Input for generating a payout batch.
 */
export interface GeneratePayoutBatchInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  adminId: string;
  ip: string;
}

/**
 * Pagination details.
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Payout batch record.
 */
export interface BatchRecord {
  _id: unknown;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: PayoutBatchStatus | string;
}

/**
 * Individual payout record.
 */
export interface PayoutRecord {
  _id: unknown;
  partnerId:
    | {
        _id: unknown;
        name: string;
        email: string;
      }
    | unknown;
  batchId: unknown;
  amount: number;
  gross?: number;
  commission?: number;
  servicesCount?: number;
  status: PayoutStatus;
  notes?: string;
  method?: string | null;
  transactionId?: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

/**
 * Input for generating a payout batch.
 */
export interface GenerateBatchInput {
  /** Needed for `custom` (or when no frequency is sent). Ignored for daily / weekly / monthly. */
  periodStart?: string | Date;
  periodEnd?: string | Date;
  /** daily | weekly | monthly: the period is worked out on the server from `date` (default: today, IST). */
  frequency?: string;
  /** "YYYY-MM-DD" day inside the wanted period. */
  date?: string;
  adminId: string;
  ip: string;
}

/**
 * Query parameters for listing payout batches.
 */
export interface PayoutBatchQuery {
  page?: number;
  limit?: number;
  status?: PayoutBatchStatus;
}

/**
 * Input for listing payout batches.
 */
export interface ListBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

/**
 * Backward-compatible alias.
 */
export type ListPayoutBatchesInput = ListBatchesInput;

/**
 * Input for marking an individual payout as paid.
 */
export interface MarkPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
  transactionId?: string;
}

/**
 * Input for confirming (paying) every unpaid payout in a batch.
 */
export interface ConfirmBatchInput {
  batchId: string;
  adminId: string;
  ip: string;
}

/**
 * Backward-compatible alias.
 */
export type MarkPayoutPaidInput = MarkPaidInput;

/**
 * Aggregated payout batch totals.
 */
export interface PayoutBatchTotals {
  gross: number;
  commission: number;
  net: number;
}

/**
 * Payout batch response returned to callers.
 */
export interface PayoutBatchResponse {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: PayoutBatchStatus;
  earningCount: number;
  payoutCount: number;
  createdAt: Date;
}

/**
 * CSV export row.
 */
export interface PayoutCsvRow {
  payoutId: string;
  partner: string;
  email: string;
  amount: number;
  status: string;
  method: string;
  transactionId: string;
  paidAt: string;
}

/**
 * Repository contract.
 */
export interface PayoutsRepository {
  generateBatch(input: {
    periodStart: Date;
    periodEnd: Date;
    adminId: string;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  }): Promise<BatchRecord>;

  listBatches(input: {
    page: number;
    limit: number;
    status?: string;
  }): Promise<{
    items: BatchRecord[];
    pagination: Pagination;
  }>;

  findBatchById(batchId: string): Promise<BatchRecord | null>;

  listPayouts(batchId: string): Promise<PayoutRecord[]>;
  markPaid(input: { payoutId: string; transactionId?: string; adminId?: string }): Promise<PayoutRecord>;
  getPayoutDetails(payoutId: string): Promise<unknown>;
  confirmBatch(input: { batchId: string; adminId: string }): Promise<{
    batch: BatchRecord;
    confirmedCount: number;
    confirmedAmount: number;
    failed: { payoutId: string; message: string }[];
  }>;
}