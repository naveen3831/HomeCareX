import http, { type ApiResponse } from "@/lib/http";
import { normalizeApiError } from "@/services/bookingApi";

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

/**
 * The backend sends `null` for names it could not resolve. The UI types use optional strings,
 * so turn null into undefined once, here.
 */
type MyReviewWire = Omit<MyReview, "serviceId" | "serviceName" | "partnerId" | "partnerName" | "bookingId"> & {
  bookingId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  partnerId: string | null;
  partnerName: string | null;
};

function toMyReview(r: MyReviewWire): MyReview {
  return {
    ...r,
    bookingId: r.bookingId ?? undefined,
    serviceId: r.serviceId ?? undefined,
    serviceName: r.serviceName ?? undefined,
    partnerId: r.partnerId ?? undefined,
    partnerName: r.partnerName ?? undefined,
    comment: r.comment ?? "",
    tags: r.tags ?? [],
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
 * POST /bookings/:id/review
 * Reviews one of the signed-in customer's completed bookings. The server takes the service and partner
 * from the booking, so only rating, tags and an optional comment are sent. Rejects with a NormalizedApiError
 * (409 = already reviewed / not completed yet, 404 = not this customer's booking).
 */
export const createBookingReview = async (
  bookingId: string,
  input: CreateBookingReviewInput,
): Promise<MyReview> => {
  const comment = input.comment?.trim();

  if (comment && comment.length > REVIEW_COMMENT_MAX) {
    throw normalizeApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: `Review must be ${REVIEW_COMMENT_MAX} characters or fewer.`,
    });
  }

  try {
    const response = await http.post<ApiResponse<MyReviewWire>>(
      `/bookings/${encodeURIComponent(bookingId)}/review`,
      {
        rating: input.rating,
        tags: input.tags,
        ...(comment ? { comment } : {}),
      },
    );

    return toMyReview(response.data.data);
  } catch (err) {
    throw normalizeApiError(err);
  }
};

/** GET /reviews/mine (legacy raw documents) */
export const fetchMyReviews = async (): Promise<CustomerReview[]> => {
  const response = await http.get<ApiResponse<CustomerReview[]>>(
    "/reviews/mine",
  );

  return response.data.data;
};

/** GET /reviews: the signed-in customer's reviews with service/partner names, tags and moderation status. */
export const fetchMyBookingReviews = async (
  signal?: AbortSignal,
): Promise<MyReview[]> => {
  try {
    const response = await http.get<ApiResponse<MyReviewWire[]>>("/reviews", {
      signal,
    });

    return response.data.data.map(toMyReview);
  } catch (err) {
    throw normalizeApiError(err);
  }
};

/** GET /reviews/pending: completed bookings the customer has not reviewed yet. */
export const fetchPendingReviews = async (
  signal?: AbortSignal,
): Promise<PendingReview[]> => {
  try {
    const response = await http.get<ApiResponse<PendingReview[]>>(
      "/reviews/pending",
      { signal },
    );

    return response.data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
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

/** Public customer review shape for the Reviews page & Testimonials */
export interface PublicCustomerReview {
  id: string;
  name: string;
  city: string;
  service: string;
  category: "Cleaning" | "Plumbing" | "Electrical" | "Appliances" | "Carpentry" | string;
  tag: string;
  headline: string;
  review: string;
  rating: number;
  avatar: string;
  date: string;
  verifiedBookingsCount: number;
  helpfulCount: number;
  verified?: boolean;
  createdAt?: string;
}

export interface PublicReviewsStats {
  averageRating: number;
  totalReviews: number;
  satisfactionRate: number;
  homesServed: string;
  categoryCounts: Record<string, number>;
}

export interface PublicReviewsResponse {
  reviews: PublicCustomerReview[];
  stats: PublicReviewsStats;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FetchPublicReviewsParams {
  category?: string;
  rating?: number | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** GET /public/reviews — site-wide customer reviews and platform stats */
export const fetchPublicReviews = async (
  params: FetchPublicReviewsParams = {},
): Promise<PublicReviewsResponse> => {
  const query: Record<string, unknown> = {};
  if (params.category && params.category !== "All") {
    query.category = params.category;
  }
  if (params.rating && params.rating !== "all") {
    query.rating = params.rating;
  }
  if (params.search && params.search.trim()) {
    query.search = params.search.trim();
  }
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await http.get<
    ApiResponse<{
      reviews: PublicCustomerReview[];
      stats: PublicReviewsStats;
    }> & { meta?: PublicReviewsResponse["meta"] }
  >("/public/reviews", { params: query });

  const data = (response.data as { data?: { reviews?: PublicCustomerReview[]; stats?: PublicReviewsStats } })?.data ?? (response.data as unknown as { reviews?: PublicCustomerReview[]; stats?: PublicReviewsStats });
  const meta = (response.data as { meta?: PublicReviewsResponse["meta"] })?.meta;
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];

  return {
    reviews,
    stats: data?.stats,
    meta: meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: reviews.length,
      totalPages: 1,
    },
  };
};
