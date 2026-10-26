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
}

export interface MarkPayoutPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
}

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
