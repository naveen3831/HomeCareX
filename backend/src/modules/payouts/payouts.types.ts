
export type PayoutBatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface GeneratePayoutBatchInput {
  periodStart: string;
  periodEnd: string;
  adminId: string;
  ip: string;
}

export interface PayoutBatchQuery {
  page?: number;
  limit?: number;
  status?: PayoutBatchStatus;
}

export interface MarkPayoutPaidInput {
  payoutId: string;
  adminId: string;
  ip: string;
}

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