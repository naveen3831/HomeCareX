
import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  catalogKeys,
  fetchServiceReviews,
  retryTransient,
} from "@/services/catalogApi";

import type { NormalizedApiError } from "@/services/bookingApi";
import type { ServiceReviewsPage } from "@/types/catalog";

export const REVIEWS_PAGE_SIZE = 4;

/**
 * Loads service reviews a few at a time.
 * Supports pagination, caching, and retry handling.
 */
export function useServiceReviews(serviceId: string | undefined) {
  return useInfiniteQuery<
    ServiceReviewsPage,
    NormalizedApiError,
    InfiniteData<ServiceReviewsPage>,
    ReturnType<typeof catalogKeys.serviceReviews>,
    number
  >({
    queryKey: catalogKeys.serviceReviews(
      serviceId ?? "",
      REVIEWS_PAGE_SIZE,
    ),

    queryFn: ({ pageParam, signal }) => {
      if (!serviceId) {
        throw new Error("A service ID is required to load reviews.");
      }

      return fetchServiceReviews(
        serviceId,
        pageParam,
        REVIEWS_PAGE_SIZE,
        signal,
      );
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,

    enabled: Boolean(serviceId),
    staleTime: 60_000,
    retry: retryTransient,
  });
}
