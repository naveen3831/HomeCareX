import type { PayoutStatus } from './payouts.calc';
import type { PayoutBatchStatus } from './payouts.constants';

import type { PayoutStatus } from "./payouts.calc";

export type { PayoutStatus };

/**
 * Status of a payout batch.
 */
export type PayoutBatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

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
 * Backward-compatible alias used by payouts.service.ts.
 */
export type GenerateBatchInput = GeneratePayoutBatchInput;

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
  status: PayoutStatus;
  method?: string | null;
  transactionId?: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface GenerateBatchInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  adminId: string;
  ip: string;
}

export interface GeneratePayoutBatchInput {
  periodStart: string;
  periodEnd: string;
  adminId: string;
  ip: string;
}

export interface ListBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
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
  gross: number;
  commission: number;
  status: string;
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
  markPaid(input: { payoutId: string; transactionId?: string }): Promise<PayoutRecord>;
}

  markPaid(input: {
    payoutId: string;
    transactionId?: string;
  }): Promise<PayoutRecord>;
}
