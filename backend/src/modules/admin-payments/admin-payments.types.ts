import type { PaymentStatus, RefundStatus } from '../../models/Payment';

export interface AdminPaymentsQuery {
  status?: PaymentStatus;
  method?: string;
  from?: string;
  to?: string;
  customer?: string;
  booking?: string;
  search?: string;
  page: number;
  limit: number;
}

/**
 * Where the money of a payment has got to after the service:
 *  awaiting_payment  customer has not paid yet
 *  awaiting_service  paid online, held until the partner completes the job
 *  credited          job done: partner wallet + admin commission credited automatically
 *  processing        job done and paid, credit not applied yet (retry / legacy batch)
 *  cash_pending      Cash on Service, partner has not collected the cash yet
 *  cash_collected    Cash on Service, partner collected the cash, settlement not finished yet
 *  commission_deducted  Cash on Service, cash job settled: admin commission was cut from the partner wallet
 *  refunded          payment refunded to the customer
 *  not_applicable    failed / superseded payment, nothing to settle
 */
export type SettlementState =
  | 'awaiting_payment'
  | 'awaiting_service'
  | 'credited'
  | 'processing'
  | 'cash_pending'
  | 'cash_collected'
  | 'commission_deducted'
  | 'refunded'
  | 'not_applicable';

export interface PaymentSettlementDto {
  state: SettlementState;
  label: string;
  /** Partner's net share and the platform commission, known once the job is completed (else null). */
  partnerShare: number | null;
  commission: number | null;
  creditedAt: string | null;
}

/** Whitelisted response shape. razorpaySignature is never part of it. */
export interface AdminPaymentDto {
  id: string;
  paymentRef: string;
  bookingId: string;
  bookingRef: string;
  customer: { id: string; name: string; email?: string; phone?: string } | null;
  amount: number;
  currency: string;
  method: string | null;
  /** What the admin sees: PAID only after the service is done and the amount is credited, else PENDING. */
  status: PaymentStatus;
  /** True once the customer has actually paid (online, QR or cash), whatever `status` shows. */
  customerPaid: boolean;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  attempts: number;
  errorReason: string | null;
  paidAt: string | null;
  /** When the amount was credited after the service (partner wallet / admin commission). Null until then. */
  creditedAt: string | null;
  refund: { status: RefundStatus; amount: number | null; requestedAt: string | null };
  settlement: PaymentSettlementDto;
  createdAt: string;
  updatedAt: string;
}

export type PaymentSummary = Record<PaymentStatus, { count: number; amount: number }>;

export interface AdminPaymentsResult {
  items: AdminPaymentDto[];
  meta: { page: number; limit: number; total: number; pages: number; summary: PaymentSummary };
}