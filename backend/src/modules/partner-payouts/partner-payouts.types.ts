export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type PayoutMethod = 'bank_transfer' | 'upi';

export interface PayoutDto {
  id: string;
  amount: number;
  currency: 'INR';
  status: PayoutStatus;
  method: PayoutMethod | null;
  transactionId: string | null;
  batchId: string | null;
  paidAt: string | null;
  expectedDate: string | null;
  createdAt: string;
}
export interface PayoutsListDto {
  currency: 'INR';
  /** The payout the partner is waiting for (pending or processing), soonest first. */
  next: PayoutDto | null;
  /** Newest first. */
  history: PayoutDto[];
}