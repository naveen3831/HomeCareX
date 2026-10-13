import http from '@/lib/http';
import type { AdminPayment, AdminPaymentFilters, AdminPaymentsPage } from '@/types/adminPayment';

/** GET /admin/payments (read-only). Empty filters are dropped so the server sees a clean query. */
export async function fetchAdminPayments(filters: AdminPaymentFilters): Promise<AdminPaymentsPage> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

  const res = await http.get<{
    success: boolean;
    data: AdminPaymentsPage['items'];
    meta: AdminPaymentsPage['meta'];
  }>('/admin/payments', { params });

  return { items: res.data.data, meta: res.data.meta };
}

/** GET /admin/payments/:id (read-only), used by the payment detail page. */
export async function fetchAdminPayment(id: string): Promise<AdminPayment> {
  const res = await http.get<{ success: boolean; data: AdminPayment }>(`/admin/payments/${encodeURIComponent(id)}`);
  return res.data.data;
}
