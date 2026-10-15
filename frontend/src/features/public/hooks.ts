import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isRetryable, publicApi, USE_MOCKS, type ApiError } from './api';
import type { BannerPlacement, ReviewsParams, ServicesParams } from './schemas';

const MIN = 60_000;

export const publicKeys = {
  all: ['public'] as const,
  categories: () => [...publicKeys.all, 'categories'] as const,
  services: (p: ServicesParams) => [...publicKeys.all, 'services', p] as const,
  service: (slug: string) => [...publicKeys.all, 'service', slug] as const,
  reviews: (id: string, p: ReviewsParams) => [...publicKeys.all, 'reviews', id, p] as const,
  banners: (placement: BannerPlacement) => [...publicKeys.all, 'banners', placement] as const,
};

// Shared defaults: retry only transient errors, at most twice, with backoff. No retries on mocks.
const common = {
  retry: (count: number, err: unknown) => !USE_MOCKS && count < 2 && isRetryable(err),
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
  refetchOnWindowFocus: false,
};

/** Active categories in admin order, each with its service count. */
export const useCategories = () =>
  useQuery<Awaited<ReturnType<typeof publicApi.getCategories>>, ApiError>({
    queryKey: publicKeys.categories(),
    queryFn: ({ signal }) => publicApi.getCategories(signal),
    staleTime: 30 * MIN,
    gcTime: 60 * MIN,
    ...common,
  });

/** One page of the catalog. The previous page stays on screen while the next one loads. */
export const useServices = (params: ServicesParams = {}, options: { enabled?: boolean } = {}) =>
  useQuery<Awaited<ReturnType<typeof publicApi.getServices>>, ApiError>({
    queryKey: publicKeys.services(params),
    queryFn: ({ signal }) => publicApi.getServices(params, signal),
    enabled: options.enabled ?? true,
    staleTime: 2 * MIN,
    placeholderData: keepPreviousData,
    ...common,
  });

/** One service by slug for the details page. A 404 is never retried. */
export const useService = (slug?: string) =>
  useQuery<Awaited<ReturnType<typeof publicApi.getService>>, ApiError>({
    queryKey: publicKeys.service(slug ?? ''),
    queryFn: ({ signal }) => publicApi.getService(slug as string, signal),
    enabled: Boolean(slug),
    staleTime: 5 * MIN,
    ...common,
  });

/** Reviews + star summary of one service. Pass `service.id`; it waits until the id is known. */
export const useServiceReviews = (serviceId?: string, params: ReviewsParams = {}) =>
  useQuery<Awaited<ReturnType<typeof publicApi.getServiceReviews>>, ApiError>({
    queryKey: publicKeys.reviews(serviceId ?? '', params),
    queryFn: ({ signal }) => publicApi.getServiceReviews(serviceId as string, params, signal),
    enabled: Boolean(serviceId),
    staleTime: 2 * MIN,
    ...common,
  });

/** Banners for a placement (home). */
export const useBanners = (placement: BannerPlacement = 'home') =>
  useQuery<Awaited<ReturnType<typeof publicApi.getBanners>>, ApiError>({
    queryKey: publicKeys.banners(placement),
    queryFn: ({ signal }) => publicApi.getBanners(placement, signal),
    staleTime: 10 * MIN,
    ...common,
  });
