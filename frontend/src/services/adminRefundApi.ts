import http from '@/lib/http';

export type AdminRefundStatus =
  | 'PENDING_APPROVAL'
  | 'CREDITED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'CREDIT_FAILED'
  | 'requested'
  | 'approved'
  | 'processed'
  | 'rejected';

export interface AdminRefundCustomer {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface AdminRefundBooking {
  _id: string;
  bookingNumber?: string;
  serviceName?: string;
  scheduledAt?: string;
  status?: string;
  paymentStatus?: string;
  cancellationReason?: string;
  createdAt?: string;
  priceBreakdown?: { total?: number };
  priceSnapshot?: { total?: number };
}

export interface AdminRefundPayment {
  _id: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount: number;
  currency?: string;
  status?: string;
  method?: string;
  paidAt?: string;
}

export interface AdminRefundItem {
  _id: string;
  id?: string;
  paymentId: string | AdminRefundPayment;
  bookingId: string | AdminRefundBooking;
  customerId?: string | AdminRefundCustomer;
  amount: number;
  currency?: string;
  status: AdminRefundStatus;
  method?: string;
  reason?: string;
  rejectionReason?: string;
  walletTransactionId?: string;
  requestedBy?: string | { _id: string; name?: string; email?: string };
  approvedBy?: string | { _id: string; name?: string; email?: string };
  rejectedBy?: string | { _id: string; name?: string; email?: string };
  requestedAt?: string;
  approvedAt?: string;
  processedAt?: string;
  rejectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRefundSummaryCounts {
  pendingApproval: number;
  credited: number;
  rejected: number;
  total: number;
}

export interface AdminRefundPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  summaryCounts?: AdminRefundSummaryCounts;
}

export interface AdminRefundListResult {
  items: AdminRefundItem[];
  pagination: AdminRefundPagination;
  summaryCounts: AdminRefundSummaryCounts;
}

export interface AdminRefundFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function fetchAdminRefunds(filters: AdminRefundFilters): Promise<AdminRefundListResult> {
  const params: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') params.status = filters.status;
  if (filters.search) params.search = filters.search;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const res = await http.get<{
    success: boolean;
    data: AdminRefundItem[];
    meta: AdminRefundPagination;
    summaryCounts?: AdminRefundSummaryCounts;
  }>('/admin/refunds', { params });

  const summaryCounts =
    res.data.summaryCounts ||
    res.data.meta?.summaryCounts || {
      pendingApproval: 0,
      credited: 0,
      rejected: 0,
      total: res.data.meta?.total || 0,
    };

  return {
    items: res.data.data || [],
    pagination: res.data.meta,
    summaryCounts,
  };
}

function extractError(err: unknown, defaultMessage: string): Error {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const res = (err as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message) {
      return new Error(res.data.message);
    }
  }
  if (err instanceof Error) return err;
  return new Error(defaultMessage);
}

export async function fetchAdminRefund(id: string): Promise<AdminRefundItem> {
  try {
    const res = await http.get<{
      success: boolean;
      data: AdminRefundItem;
    }>(`/admin/refunds/${encodeURIComponent(id)}`);

    return res.data.data;
  } catch (err) {
    throw extractError(err, 'Failed to fetch refund details');
  }
}

export async function approveAdminRefund(id: string): Promise<AdminRefundItem> {
  try {
    const res = await http.post<{
      success: boolean;
      message: string;
      data: AdminRefundItem;
    }>(`/admin/refunds/${encodeURIComponent(id)}/approve`);

    return res.data.data;
  } catch (err) {
    throw extractError(err, 'Failed to approve refund');
  }
}

export async function rejectAdminRefund(id: string, reason: string): Promise<AdminRefundItem> {
  try {
    const res = await http.post<{
      success: boolean;
      message: string;
      data: AdminRefundItem;
    }>(`/admin/refunds/${encodeURIComponent(id)}/reject`, { reason });

    return res.data.data;
  } catch (err) {
    throw extractError(err, 'Failed to reject refund');
  }
}
