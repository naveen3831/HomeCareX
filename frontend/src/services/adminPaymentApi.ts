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


export type ReferralAudience = 'CUSTOMER' | 'PARTNER';
export interface ReferralPerson { id: string; name: string; email?: string; phone?: string; role: string }
export interface ReferralCredit {
  id: string;
  referralId: string;
  audience: ReferralAudience;
  side: 'referrer' | 'friend';
  user: ReferralPerson | null;
  amount: number;
  wallet: 'customer_wallet' | 'partner_wallet';
  creditedAt: string | null;
}
export interface ReferralDiscount {
  id: string;
  bookingId: string;
  bookingRef: string;
  customer: ReferralPerson | null;
  program: string | null;
  amount: number;
  usedAt: string;
}
interface ReferralBucket { referrals: number; referrerCredited: number; friendCredited: number }
export interface ReferralMoney {
  totals: {
    customer: ReferralBucket;
    partner: ReferralBucket;
    totalCredited: number;
    discountUsed: { count: number; amount: number };
  };
  credits: ReferralCredit[];
  discounts: ReferralDiscount[];
  meta: { page: number; limit: number; total: number; pages: number };
}

/** GET /admin/payments/referrals (read-only): referral wallet credits + referral discounts used on bookings. */
export async function fetchAdminReferralMoney(params: { page: number; limit: number; type?: ReferralAudience }): Promise<ReferralMoney> {
  const res = await http.get<{ success: boolean; data: ReferralMoney }>('/admin/payments/referrals', { params });
  return res.data.data;
}
