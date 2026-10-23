import http, { type ApiResponse } from "@/lib/http";
import {
  sanitizeLimit,
  sanitizePage,
  sanitizePathSegment,
  sanitizeServicesParams,
} from "@/lib/querySanitize";
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

/** Retry network failures and server errors, but never client errors (a bad query can't be fixed by retrying). */
export const retryTransient = (
  failureCount: number,
  error: NormalizedApiError,
): boolean =>
  failureCount < 2 &&
  (error.status === 0 || error.status >= 500);

/** Wait 1s, then 2s (max 5s) between retries so a flaky network is not hammered. */
export const retryBackoff = (attempt: number): number => Math.min(1000 * 2 ** attempt, 5000);

/** A malformed slug or id can never match a service, so we fail as a 404 without sending a request. */
const NOT_FOUND: NormalizedApiError = {
  status: 404,
  code: "NOT_FOUND",
  message: "We could not find what you were looking for.",
};

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
 * GET /services with sanitized filter, sort and page params.
 * sanitizeServicesParams (lib/querySanitize.ts) allow-lists sort, caps lengths, forces page >= 1
 * and caps limit, so page=-1, limit=1000 or sort=<injection> never reach the backend.
 */
export async function fetchServices(
  params: ServiceListParams,
  signal?: AbortSignal,
): Promise<ServicePage> {
  try {
    const { data } = await http.get<ApiListResponse<ServicePage["items"]>>(
      "/services",
      {
        params: sanitizeServicesParams(params),
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
export async function fetchServiceDetail(rawSlug: string, signal?: AbortSignal): Promise<ServiceDetail> {
  const slug = sanitizePathSegment(rawSlug);
  if (!slug) throw NOT_FOUND;

  try {
    const { data } = await http.get<ApiResponse<ServiceDetail>>(`/services/${encodeURIComponent(slug)}`, { signal });
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** GET /services/:id/reviews: one page of visible reviews plus the star distribution of the whole set. */
export async function fetchServiceReviews(
  rawServiceId: string,
  rawPage: number,
  rawLimit: number,
  signal?: AbortSignal,
): Promise<ServiceReviewsPage> {
  const serviceId = sanitizePathSegment(rawServiceId);
  if (!serviceId) throw NOT_FOUND;
  const page = sanitizePage(rawPage);
  const limit = sanitizeLimit(rawLimit);

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