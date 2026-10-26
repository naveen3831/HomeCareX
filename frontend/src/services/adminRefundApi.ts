import http from '@/lib/http';

export const REFUND_STATUSES = ['requested', 'approved', 'processed', 'rejected'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** One row of GET /admin/refunds (payment, booking and customer are populated by the server). */
export interface AdminRefund {
  _id: string;
  amount: number;
  currency: string;
  reason: string;
  method: 'RAZORPAY' | 'WALLET';
  status: RefundStatus;
  razorpayRefundId?: string;
  rejectionReason?: string;
  requestedAt?: string;
  processedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  paymentId?: { _id: string; razorpayPaymentId?: string; razorpayOrderId?: string; amount?: number; currency?: string; method?: string; status?: string } | null;
  bookingId?: { _id: string; serviceName?: string } | null;
  customerId?: { _id: string; name?: string; email?: string; phone?: string } | null;
  requestedBy?: { name?: string } | null;
  approvedBy?: { name?: string } | null;
  rejectedBy?: { name?: string } | null;
}

export interface AdminRefundsResult {
  items: AdminRefund[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface RefundFilters { status?: RefundStatus | ''; search?: string; page?: number; limit?: number }

/** GET /admin/refunds. Empty filters are dropped. */
export async function fetchAdminRefunds(filters: RefundFilters): Promise<AdminRefundsResult> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const res = await http.get<{ success: boolean; data: AdminRefund[]; meta: AdminRefundsResult['meta'] }>('/admin/refunds', { params });
  return { items: res.data.data, meta: res.data.meta };
}

/** PATCH /admin/refunds/:id. Needs payments:refund. A rejection must carry a reason. */
export async function decideRefund(id: string, action: 'approve' | 'reject', rejectionReason?: string): Promise<AdminRefund> {
  const res = await http.patch<{ success: boolean; data: AdminRefund }>(`/admin/refunds/${encodeURIComponent(id)}`, {
    action,
    ...(action === 'reject' ? { rejectionReason } : {}),
  });
  return res.data.data;
}
