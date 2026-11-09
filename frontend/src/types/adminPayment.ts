export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type RefundStatus = 'none' | 'requested' | 'approved' | 'processed' | 'rejected';

/** Where a payment's money stands after the service (set by the backend, never computed here). */
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

export interface PaymentSettlement {
  state: SettlementState;
  label: string;
  /** Partner's net share and platform commission; null until the job is completed. */
  partnerShare: number | null;
  commission: number | null;
  creditedAt: string | null;
}

/** Mirrors GET /admin/payments. Note: no signature / secret fields exist on purpose. */
export interface AdminPayment {
  id: string;
  paymentRef: string;
  bookingId: string;
  bookingRef: string;
  customer: { id: string; name: string; email?: string; phone?: string } | null;
  amount: number;
  currency: string;
  method: string | null;
  /** What the admin sees: Paid only after the service is done and the amount is credited, otherwise Pending. */
  status: PaymentStatus;
  /** True once the customer has actually paid, whatever `status` shows. */
  customerPaid: boolean;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  attempts: number;
  errorReason: string | null;
  paidAt: string | null;
  /** When the amount was credited after the service (null until then). */
  creditedAt: string | null;
  refund: { status: RefundStatus; amount: number | null; requestedAt: string | null };
  settlement: PaymentSettlement;
  createdAt: string;
  updatedAt: string;
}

export type PaymentSummary = Record<PaymentStatus, { count: number; amount: number }>;

export interface AdminPaymentsPage {
  items: AdminPayment[];
  meta: { page: number; limit: number; total: number; pages: number; summary: PaymentSummary };
}

export interface AdminPaymentFilters {
  status?: PaymentStatus | '';
  method?: string;
  from?: string;
  to?: string;
  customer?: string;
  booking?: string;
  search?: string;
  page?: number;
  limit?: number;
}