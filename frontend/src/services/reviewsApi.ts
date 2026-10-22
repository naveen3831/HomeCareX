import http, { type ApiResponse } from "@/lib/http";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface CustomerReview {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  message: string;
  status: ReviewStatus;
  serviceId?: string;
  bookingId?: string;
  verified?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A review as shown to the customer on "My reviews". */
export interface MyReview {
  id: string;
  bookingId?: string;
  serviceId?: string;
  serviceName?: string;
  partnerId?: string;
  partnerName?: string;
  rating: number;
  comment: string;
  tags: string[];
  status: ReviewStatus;
  /** True once the review is approved and publicly visible. */
  visible: boolean;
  verified: boolean;
  createdAt: string;
  /** Raw backend fields, kept optional for code that still reads them. */
  _id?: string;
  message?: string;
  updatedAt?: string;
}

export interface PendingReview {
  bookingId: string;
  serviceId: string;
  serviceName: string;
  partnerId: string;
  partnerName?: string;
  /** ISO date string of when the booking was completed. */
  completedOn: string;
}

export const REVIEW_TAGS = [
  "Professional",
  "On time",
  "Good quality",
  "Clean work",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

export const REVIEW_COMMENT_MAX = 2000;

export interface CreateBookingReviewInput {
  rating: number;
  tags: ReviewTag[];
  comment?: string;
}

export interface AdminReviewsResponse {
  reviews: CustomerReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export interface CreateReviewInput {
  rating: number;
  message: string;
  serviceId?: string;
  bookingId?: string;
}

/** Convert backend review records into the frontend's review shape. */
function toMyReview(review: CustomerReview): MyReview {
  return {
    ...review,
    id: review._id,
    comment: review.message,
    tags: [],
    visible: review.status === "approved",
    verified: review.verified ?? false,
  };
}

/** POST /reviews */
export const createReview = async (
  input: CreateReviewInput,
): Promise<CustomerReview> => {
  const response = await http.post<ApiResponse<CustomerReview>>(
    "/reviews",
    input,
  );

  return response.data.data;
};

/**
 * Submit a review for a specific completed booking.
 * Backend requires a message between 20 and 2000 characters.
 *
 * Note: tags are not persisted because the current backend model
 * and validation schema do not support them.
 */
export const createBookingReview = async (
  bookingId: string,
  input: CreateBookingReviewInput & { serviceId?: string },
): Promise<MyReview> => {
  const message = input.comment?.trim() ?? "";

  if (message.length < 20) {
    throw new Error("Please enter a review of at least 20 characters.");
  }

  if (message.length > REVIEW_COMMENT_MAX) {
    throw new Error(
      `Review must be ${REVIEW_COMMENT_MAX} characters or fewer.`,
    );
  }

  const serviceId = input.serviceId;

  if (!serviceId) {
    throw new Error("Service ID is required to submit a booking review.");
  }

  const review = await createReview({
    rating: input.rating,
    message,
    serviceId,
    bookingId,
  });

  return toMyReview(review);
};

/** GET /reviews/mine */
export const fetchMyReviews = async (): Promise<CustomerReview[]> => {
  const response = await http.get<ApiResponse<CustomerReview[]>>(
    "/reviews/mine",
  );

  return response.data.data;
};

/** GET /reviews/mine — booking-review hook shape */
export const fetchMyBookingReviews = async (
  signal?: AbortSignal,
): Promise<MyReview[]> => {
  const response = await http.get<ApiResponse<CustomerReview[]>>(
    "/reviews/mine",
    { signal },
  );

  return response.data.data.map(toMyReview);
};

/**
 * No pending-bookings-for-review endpoint has been confirmed in the
 * backend routes provided so far.
 *
 * Return an empty list until a real backend endpoint is implemented.
 * This prevents an invalid network request, but does not discover
 * bookings that still need reviews.
 */
export const fetchPendingReviews = async (
  _signal?: AbortSignal,
): Promise<PendingReview[]> => {
  return [];
};

/** GET /admin/reviews */
export const fetchAdminReviews = async (params: {
  page: number;
  search?: string;
  status?: ReviewStatus | "";
}): Promise<AdminReviewsResponse> => {
  const query = {
    page: params.page,
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
  };

  const response = await http.get<ApiResponse<AdminReviewsResponse>>(
    "/admin/reviews",
    { params: query },
  );

  return response.data.data;
};

/** PATCH /admin/reviews/:id/status */
export const updateReviewStatus = async (input: {
  id: string;
  status: ReviewStatus;
}): Promise<CustomerReview> => {
  const response = await http.patch<ApiResponse<CustomerReview>>(
    `/admin/reviews/${encodeURIComponent(input.id)}/status`,
    { status: input.status },
  );

  return response.data.data;
};

/** GET /services/:id/reviews */
export interface PublicServiceReview {
  id: string;
  rating: number;
  comment: string;
  author: string;
  verified: boolean;
  createdAt: string;
}

export interface ServiceReviewSummary {
  average: number;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface ServiceReviewsResponse {
  summary: ServiceReviewSummary;
  reviews: PublicServiceReview[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const fetchServiceReviews = async (
  serviceId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ServiceReviewsResponse> => {
  const response = await http.get<
    ApiResponse<{
      summary: ServiceReviewSummary;
      reviews: PublicServiceReview[];
    }> & { meta?: ServiceReviewsResponse["meta"] }
  >(`/services/${encodeURIComponent(serviceId)}/reviews`, { params });

  const data = response.data.data;
  const meta = response.data.meta;

  return {
    ...data,
    meta: meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      total: data.summary.count,
      totalPages: Math.ceil(
        data.summary.count / (params.limit ?? 10),
      ),
    },
  };
};