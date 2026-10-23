
export interface GeneratePayoutBatchInput {
  periodStart: string;
  periodEnd: string;
  adminId: string;
  ip: string;
}

export interface ListPayoutBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
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
