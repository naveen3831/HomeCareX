import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  catalogKeys,
  fetchServiceDetail,
  fetchServiceReviews,
  fetchServices,
  retryBackoff,
  retryTransient,
} from "@/services/catalogApi";
import type { NormalizedApiError } from "@/services/bookingApi";
import type {
  CatalogService,
  ServiceDetail,
  ServiceListParams,
  ServiceReviewsPage,
} from "@/types/catalog";

export const REVIEWS_PAGE_SIZE = 10;

/**
 * GET /services/:slug. A 404 error means the slug is unknown, inactive or malformed
 * (a malformed slug is rejected before any request is sent). 404s are never retried;
 * network blips and 5xx are retried twice with backoff (1s, 2s).
 */
export function useService(slug: string | undefined) {
  return useQuery<ServiceDetail, NormalizedApiError>({
    queryKey: catalogKeys.service(slug ?? ""),
    queryFn: ({ signal }) => fetchServiceDetail(slug as string, signal),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: (failureCount, error) => retryTransient(failureCount, error),
    retryDelay: retryBackoff,
  });
}

/**
 * GET /services/:id/reviews, loaded page by page.
 * Only fetches when `enabled` is true (for example, when the Reviews tab is open).
 */
export function useServiceReviews(
  serviceId: string | undefined,
  enabled: boolean,
) {
  const query = useInfiniteQuery<
    ServiceReviewsPage,
    NormalizedApiError,
    InfiniteData<ServiceReviewsPage, number>,
    ReturnType<typeof catalogKeys.serviceReviews>,
    number
  >({
    queryKey: catalogKeys.serviceReviews(serviceId ?? "", REVIEWS_PAGE_SIZE),
    queryFn: ({ pageParam, signal }) =>
      fetchServiceReviews(
        serviceId as string,
        pageParam,
        REVIEWS_PAGE_SIZE,
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: Boolean(serviceId) && enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => retryTransient(failureCount, error),
    retryDelay: retryBackoff,
  });

  return {
    ...query,
    /** Star summary for the whole review set (same on every page). */
    summary: query.data?.pages[0]?.summary,
    /** Reviews from every page loaded so far. */
    reviews: query.data?.pages.flatMap((page) => page.reviews) ?? [],
  };
}

/** Other services in the same category, excluding the current one. */
export function useRelatedServices(
  categorySlug: string | undefined,
  excludeId: string | undefined,
) {
  const params: ServiceListParams = {
    category: categorySlug,
    sort: "popular",
    page: 1,
    limit: 4,
  };

  return useQuery<
    Awaited<ReturnType<typeof fetchServices>>,
    NormalizedApiError,
    CatalogService[]
  >({
    queryKey: catalogKeys.services(params),
    queryFn: ({ signal }) => fetchServices(params, signal),
    enabled: Boolean(categorySlug),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => retryTransient(failureCount, error),
    retryDelay: retryBackoff,
    select: (page) =>
      page.items.filter((item) => item.id !== excludeId).slice(0, 3),
  });
}