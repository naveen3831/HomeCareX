import http, { type ApiResponse } from "@/lib/http";
import type {
  CatalogCategory,
  PageMeta,
  ReviewSummary,
  ServiceDetail,
  ServiceListParams,
  ServicePage,
  ServiceReview,
  ServiceReviewsPage,
} from "@/types/catalog";
import { normalizeApiError, type NormalizedApiError } from "./bookingApi";

interface ApiListResponse<T> extends ApiResponse<T> {
  meta: PageMeta;
}

export const catalogKeys = {
  categories: ["catalog", "categories"] as const,
  services: (params: ServiceListParams) => ["catalog", "services", params] as const,
  service: (slug: string) => ["catalog", "service", slug] as const,
  serviceReviews: (serviceId: string, limit: number) => ["catalog", "service-reviews", serviceId, limit] as const,
};

/** Retry network blips and 5xx; never 4xx (a bad query can't be fixed by retrying). */
/** Retry network failures and server errors, but never client errors. */
export const retryTransient = (
  failureCount: number,
  error: NormalizedApiError,
): boolean =>
  failureCount < 2 &&
  (error.status === 0 || error.status >= 500);

/** GET /categories: active, admin-ordered, each with its service count. */
export async function fetchCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
  try {
    const { data } = await http.get<ApiResponse<CatalogCategory[]>>("/categories", { signal });
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}


/**
 * Removes invalid or empty query parameters before sending them to the API.
 */

function sanitizeServiceParams(
  params: ServiceListParams,
): Record<string, string | number> {
  const sanitized: Record<string, string | number> = {};

  if (typeof params.q === "string" && params.q.trim()) {
    sanitized.q = params.q.trim();
  }

  if (typeof params.category === "string" && params.category.trim()) {
    sanitized.category = params.category.trim();
  }

  if (
    typeof params.rating === "number" &&
    Number.isFinite(params.rating) &&
    params.rating >= 1 &&
    params.rating <= 5
  ) {
    sanitized.rating = params.rating;
  }

  if (
    typeof params.minPrice === "number" &&
    Number.isFinite(params.minPrice) &&
    params.minPrice >= 0
  ) {
    sanitized.minPrice = params.minPrice;
  }

  if (
    typeof params.maxPrice === "number" &&
    Number.isFinite(params.maxPrice) &&
    params.maxPrice >= 0
  ) {
    sanitized.maxPrice = params.maxPrice;
  }

  if (
    typeof params.minPrice === "number" &&
    typeof params.maxPrice === "number" &&
    params.minPrice > params.maxPrice
  ) {
    delete sanitized.minPrice;
    delete sanitized.maxPrice;
  }

  if (
    typeof params.duration === "number" &&
    Number.isInteger(params.duration) &&
    params.duration > 0
  ) {
    sanitized.duration = params.duration;
  }

  if (
    params.availability === "today" ||
    params.availability === "tomorrow"
  ) {
    sanitized.availability = params.availability;
  }

  const allowedSorts = [
    "popular",
    "rating",
    "price-asc",
    "price-desc",
    "newest",
    "relevance",
  ];

  if (
    typeof params.sort === "string" &&
    allowedSorts.includes(params.sort)
  ) {
    sanitized.sort = params.sort;
  }

  sanitized.page =
    Number.isInteger(params.page) && params.page >= 1
      ? params.page
      : 1;

  sanitized.limit =
    Number.isInteger(params.limit) && params.limit >= 1
      ? Math.min(params.limit, 100)
      : 10;

  return sanitized;
}


/** GET /services with every filter, sort and page param. */

/** GET /services with sanitized filter, sort and page params. */
export async function fetchServices(
  params: ServiceListParams,
  signal?: AbortSignal,
): Promise<ServicePage> {
  try {
    const { data } = await http.get<ApiListResponse<ServicePage["items"]>>(
      "/services",
      {
        params: sanitizeServiceParams(params),
        signal,
      },
    );

    return {
      items: data.data,
      meta: data.meta,
    };
  } catch (err) {
    throw normalizeApiError(err);
  }
}


/** GET /services/:slug: everything the details page shows. Unknown or inactive slug is a 404. */
export async function fetchServiceDetail(slug: string, signal?: AbortSignal): Promise<ServiceDetail> {
  try {
    const { data } = await http.get<ApiResponse<ServiceDetail>>(`/services/${encodeURIComponent(slug)}`, { signal });
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** GET /services/:id/reviews: one page of visible reviews plus the star distribution of the whole set. */
export async function fetchServiceReviews(
  serviceId: string,
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<ServiceReviewsPage> {
  try {
    const { data } = await http.get<ApiListResponse<{ summary: ReviewSummary; reviews: ServiceReview[] }>>(
      `/services/${encodeURIComponent(serviceId)}/reviews`,
      { params: { page, limit }, signal },
    );
    return { summary: data.data.summary, reviews: data.data.reviews, meta: data.meta };
  } catch (err) {
    throw normalizeApiError(err);
  }
}
