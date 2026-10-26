import type { QueryClient } from "@tanstack/react-query";

import { bannersQueryOptions } from "@/hooks/useBanners";
import {
  parseServicesQuery,
  sanitizePathSegment,
  uiSortToApi,
} from "@/lib/querySanitize";
import {
  catalogKeys,
  fetchServiceDetail,
  fetchServices,
} from "@/services/catalogApi";
import type { ServiceListParams } from "@/types/catalog";

/**
 * Route chunk loaders. PublicRoutes uses these same functions inside React.lazy(),
 * so a prefetch and the real navigation share one download (the browser caches the module).
 */
export const loadServicesPage = () => import("@/pages/public/Services/index");
export const loadServiceDetailsPage = () => import("@/pages/public/ServiceDetails");

/** Must match the staleTime of useService(), otherwise a prefetched entry would be refetched on mount. */
const SERVICE_DETAILS_STALE_MS = 60_000;

/** Must equal ITEMS_PER_PAGE in pages/public/Services/index.tsx, or the cache key will not match. */
const SERVICES_PAGE_LIMIT = 6;

/** Must match the staleTime in useServices(). */
const SERVICES_STALE_MS = 30_000;

const SERVICE_PATH = /^\/services\/([^/?#]+)\/?$/;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Prefetching spends the visitor's data, so skip it on Data Saver and on 2G / slow-2G. */
export function connectionAllowsPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/2g$/.test(connection.effectiveType ?? "");
}

/** "/services/home-cleaning" -> "home-cleaning". Returns null for any other link (or an unsafe slug). */
export function slugFromHref(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;

  const match = SERVICE_PATH.exec(url.pathname);
  if (!match) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return sanitizePathSegment(slug) || null;
}

/** Warms the service details chunk and the GET /services/:slug response. Never throws. */
export function prefetchServiceDetails(queryClient: QueryClient, slug: string): void {
  if (!connectionAllowsPrefetch()) return;

  loadServiceDetailsPage().catch(() => undefined);
  // prefetchQuery skips the request when the entry is fresh or already in flight, and swallows errors.
  void queryClient.prefetchQuery({
    queryKey: catalogKeys.service(slug),
    queryFn: ({ signal }) => fetchServiceDetail(slug, signal),
    staleTime: SERVICE_DETAILS_STALE_MS,
  });
}

/**
 * Home: start the banners request and download the (lazy) BannerSlider chunk at the same time.
 * Without this the request only starts after the chunk has loaded and rendered, which is a waterfall.
 */
export function prefetchHomeData(queryClient: QueryClient): void {
  void queryClient.prefetchQuery(bannersQueryOptions());
  import("@/components/public/BannerSlider").catch(() => undefined);
}

/**
 * Services: start the API request and the page chunk at the same time, before React renders.
 * Uses the same URL parsing as the page, so the cache key matches and the page reuses the result.
 */
export function prefetchServicesData(queryClient: QueryClient): void {
  const { q, category, sort, page } = parseServicesQuery(
    new URLSearchParams(window.location.search),
  );

  const params: ServiceListParams = {
    q: q || undefined,
    category: category || undefined,
    sort: uiSortToApi(sort),
    page,
    limit: SERVICES_PAGE_LIMIT,
  };

  void queryClient.prefetchQuery({
    queryKey: catalogKeys.services(params),
    queryFn: ({ signal }) => fetchServices(params, signal),
    staleTime: SERVICES_STALE_MS,
  });
  loadServicesPage().catch(() => undefined);
}

/** After the page is idle, download the chunk of the page a visitor most likely opens next. */
/** Warm a main page's chunk only when the visitor shows intent (hover / focus / touch on its link). */
export function prefetchRouteChunk(href: string): void {
  if (!connectionAllowsPrefetch()) return;
  let path: string;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    path = url.pathname.replace(/\/$/, "") || "/";
  } catch {
    return;
  }
  if (path === "/services") loadServicesPage().catch(() => undefined);
}