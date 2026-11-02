import type { PayoutStatus } from './payouts.constants';

export interface BatchRecord {
  _id: unknown;
  periodStart: Date | string;
  periodEnd: Date | string;
  gross: number;
  commission: number;
  net: number;
  status: string;
  createdBy?: unknown;
  earningIds?: unknown[];
  payoutIds?: unknown[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PayoutRecord {
  _id: unknown;
  partnerId: unknown;
  batchId: unknown;
  amount: number;
  status: PayoutStatus;
  method?: string | null;
  transactionId?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
}

export interface GenerateBatchInput {
  periodStart: Date | string;
  periodEnd: Date | string;
  adminId: string;
  ip: string;
}

export interface ListBatchesInput {
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>;
  findBatchById(batchId: string): Promise<BatchRecord | null>;
  listPayouts(batchId: string): Promise<PayoutRecord[]>;
  markPaid(input: {
    payoutId: string;
    transactionId?: string;
  }): Promise<PayoutRecord>;
}
