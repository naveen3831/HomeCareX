export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type RefundStatus = 'none' | 'requested' | 'approved' | 'processed' | 'rejected';

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
  status: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  attempts: number;
  errorReason: string | null;
  paidAt: string | null;
  refund: { status: RefundStatus; amount: number | null; requestedAt: string | null };
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