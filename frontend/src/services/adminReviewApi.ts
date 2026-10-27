import http from '@/lib/http';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/** One row of GET /admin/reviews. partnerName is null when no partner is assigned (never a placeholder). */
export interface AdminReview {
  _id: string;
  customerName: string;
  customerEmail?: string;
  rating: number;
  message?: string;
  status: ReviewStatus;
  visible?: boolean;
  verified?: boolean;
  tags?: string[];
  serviceId?: string;
  bookingId?: string;
  partnerId?: string | null;
  partnerName?: string | null;
  createdAt: string;
}

export interface AdminReviewsResult {
  reviews: AdminReview[];
  pagination: { page: number; limit: number; total: number; pages: number };
  stats: { total: number; pending: number; approved: number; rejected: number };
}

export interface ReviewFilters { status?: ReviewStatus | ''; search?: string; page?: number; limit?: number }

export async function fetchAdminReviews(filters: ReviewFilters): Promise<AdminReviewsResult> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const res = await http.get<{ success: boolean; data: AdminReviewsResult }>('/admin/reviews', { params });
  return res.data.data;
}

/** PATCH /admin/reviews/:id/status */
export async function setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  await http.patch(`/admin/reviews/${encodeURIComponent(id)}/status`, { status });
}

/** PATCH /admin/reviews/:id/visibility. Needs reviews:moderate. */
export async function setReviewVisibility(id: string, visible: boolean): Promise<void> {
  await http.patch(`/admin/reviews/${encodeURIComponent(id)}/visibility`, { visible });
}
