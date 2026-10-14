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

export interface AdminPaymentsResult {
  items: AdminPaymentDto[];
  meta: { page: number; limit: number; total: number; pages: number; summary: PaymentSummary };
}