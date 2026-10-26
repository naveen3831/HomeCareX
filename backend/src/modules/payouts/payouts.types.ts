<<<<<<< HEAD

export type PayoutBatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
=======
import type { PayoutStatus } from './payouts.calc';

export type { PayoutStatus };

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface BatchRecord {
  _id: unknown;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: string;
}

export interface PayoutRecord {
  _id: unknown;
  partnerId: { _id: unknown; name: string; email: string } | unknown;
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
>>>>>>> origin/develop

export interface GeneratePayoutBatchInput {
  periodStart: string;
  periodEnd: string;
  adminId: string;
  ip: string;
}

<<<<<<< HEAD
export interface PayoutBatchQuery {
  page?: number;
  limit?: number;
  status?: PayoutBatchStatus;
=======
export interface ListBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

export interface ListPayoutBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

export interface MarkPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
  transactionId?: string;
>>>>>>> origin/develop
}

export interface MarkPayoutPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
}

<<<<<<< HEAD
export interface PayoutBatchTotals {
  gross: number;
  commission: number;
  net: number;
}

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
=======
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

export interface PayoutsRepository {
  generateBatch(input: { periodStart: Date; periodEnd: Date; adminId: string }): Promise<BatchRecord>;
  listBatches(input: { page: number; limit: number; status?: string }): Promise<{ items: BatchRecord[]; pagination: Pagination }>;
  findBatchById(batchId: string): Promise<BatchRecord | null>;
  listPayouts(batchId: string): Promise<PayoutRecord[]>;
  markPaid(input: { payoutId: string; transactionId?: string }): Promise<PayoutRecord>;
}
>>>>>>> origin/develop
