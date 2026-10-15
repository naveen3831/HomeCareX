import http, { type ApiResponse } from '@/lib/http';
import { normalizeApiError } from '@/services/bookingApi';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CustomerReview {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  message: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReviewsResponse {
  reviews: CustomerReview[];
  pagination: { page: number; limit: number; total: number; pages: number };
  stats: { total: number; pending: number; approved: number; rejected: number };
}

export const createReview = async (input: { rating: number; message: string }): Promise<CustomerReview> => {
  const response = await http.post<ApiResponse<CustomerReview>>('/reviews', input);
  return response.data.data;
};

export const fetchMyReviews = async (): Promise<CustomerReview[]> => {
  const response = await http.get<ApiResponse<CustomerReview[]>>('/reviews/mine');
  return response.data.data;
};

export const fetchAdminReviews = async (params: {
  page: number;
  search?: string;
  status?: ReviewStatus | '';
}): Promise<AdminReviewsResponse> => {
  const query = {
    page: params.page,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
  const response = await http.get<ApiResponse<AdminReviewsResponse>>('/admin/reviews', { params: query });
  return response.data.data;
};

export const updateReviewStatus = async (input: { id: string; status: ReviewStatus }): Promise<CustomerReview> => {
  const response = await http.patch<ApiResponse<CustomerReview>>(`/admin/reviews/${input.id}/status`, { status: input.status });
  return response.data.data;
};

/* ------------------------------------------------------------------ */
/* Booking reviews: GET /reviews, GET /reviews/pending,                */
/* POST /bookings/:id/review (completed + own booking, once)           */
/* ------------------------------------------------------------------ */

/** Quick-pick tags on the review form. The server accepts exactly these four, as written. */
export const REVIEW_TAGS = ['Professional', 'On time', 'Good quality', 'Clean work'] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];
export const REVIEW_COMMENT_MAX = 2000;

/** A review the signed-in customer wrote (GET /reviews). Names are resolved by the server. */
export interface MyReview {
  id: string;
  bookingId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  partnerId: string | null;
  partnerName: string | null;
  rating: number;
  comment: string;
  tags: string[];
  status: ReviewStatus;
  visible: boolean;
  verified: boolean;
  createdAt: string;
}

/** A completed booking still waiting for a review (GET /reviews/pending). */
export interface PendingReview {
  bookingId: string;
  serviceId: string | null;
  serviceName: string;
  partnerId: string | null;
  partnerName: string | null;
  completedOn: string;
}

export interface CreateBookingReviewInput {
  rating: number;
  comment?: string;
  tags: ReviewTag[];
}

export async function fetchMyBookingReviews(signal?: AbortSignal): Promise<MyReview[]> {
  try {
    const { data } = await http.get<ApiResponse<MyReview[]>>('/reviews', { signal });
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

export async function fetchPendingReviews(signal?: AbortSignal): Promise<PendingReview[]> {
  try {
    const { data } = await http.get<ApiResponse<PendingReview[]>>('/reviews/pending', { signal });
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** 400 missing/invalid rating, 404 not your booking, 409 not completed yet or already reviewed. */
export async function createBookingReview(bookingId: string, input: CreateBookingReviewInput): Promise<MyReview> {
  try {
    const body: CreateBookingReviewInput = { rating: input.rating, tags: input.tags };
    const comment = input.comment?.trim();
    if (comment) body.comment = comment;
    const { data } = await http.post<ApiResponse<MyReview>>(`/bookings/${encodeURIComponent(bookingId)}/review`, body);
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}
