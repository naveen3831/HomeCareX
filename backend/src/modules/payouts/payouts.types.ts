
import type { PayoutStatus } from './payouts.calc';

export type { PayoutStatus };

// Generate a payout batch
export interface GeneratePayoutBatchInput {
  periodStart: string | Date;
  periodEnd: string | Date;
  adminId: string;
  ip: string;
}

// Backward-compatible name used by payouts.service.ts
export type GenerateBatchInput = GeneratePayoutBatchInput;

// Pagination details
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Payout batch record
export interface BatchRecord {
  _id: unknown;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: string;
}

// Individual payout record
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

// List payout batches
export interface ListBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

// Backward-compatible alias
export type ListPayoutBatchesInput = ListBatchesInput;

// Mark an individual payout as paid
export interface MarkPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
  transactionId?: string;
}

// Backward-compatible alias
export type MarkPayoutPaidInput = MarkPaidInput;

// CSV export row
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

// Repository contract
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

  markPaid(input: {
    payoutId: string;
    transactionId?: string;
  }): Promise<PayoutRecord>;
}
