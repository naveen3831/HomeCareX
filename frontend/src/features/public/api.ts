import { z } from 'zod';
import http from '@/lib/http';
import { classifyApiError } from '@/lib/apiError';
import {
  bannersSchema,
  categoriesSchema,
  reviewsPageSchema,
  serviceDetailSchema,
  servicesPageSchema,
  type Banner,
  type BannerPlacement,
  type Category,
  type ReviewsPage,
  type ReviewsParams,
  type ServiceDetail,
  type ServicesPage,
  type ServicesParams,
} from './schemas';
import {
  mockBanners,
  mockCategories,
  mockReviewsFor,
  mockServiceDetails,
  mockServices,
} from '@/constants/mock/public';

/** true = serve everything from constants/mock/public.ts, false = call the real backend. */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/* ----------------------------- error mapping ----------------------------- */

export type PublicApiErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'not_found'
  | 'unauthorized'
  | 'client'
  | 'server'
  | 'contract'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    public kind: PublicApiErrorKind,
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MESSAGES = {
  not_found: 'We could not find what you were looking for.',
  unauthorized: 'You do not have access to this content.',
  server: 'Something went wrong on our side. Please try again shortly.',
  contract: 'We received unexpected data from the server. Please try again later.',
} as const;

/** Turns anything thrown by lib/http (or us) into one ApiError with a user-safe message. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  const c = classifyApiError(err);
  if (c.kind === 'http') {
    const status = c.status ?? 0;
    if (status === 404) return new ApiError('not_found', MESSAGES.not_found, status);
    if (status === 401 || status === 403) return new ApiError('unauthorized', MESSAGES.unauthorized, status);
    if (status >= 500) return new ApiError('server', MESSAGES.server, status);
    return new ApiError('client', c.message, status, c.details);
  }
  return new ApiError(c.kind, c.message, c.status);
}

/** Only transient failures are worth retrying; a 4xx or a contract mismatch will not fix itself. */
export const isRetryable = (err: unknown) =>
  !(err instanceof ApiError) || ['offline', 'network', 'timeout', 'server'].includes(err.kind);

/* ------------------------------- helpers -------------------------------- */

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown, path: string): z.output<S>{
  const result = schema.safeParse(data);
  if (!result.success) {
    // Loud in dev so contract gaps can be reported to the endpoint owner.
    if (import.meta.env.DEV) console.error(`[contract] ${path} does not match the schema`, result.error?.issues);
    throw new ApiError('contract', MESSAGES.contract, undefined, result.error?.issues);
  }
  return result.data;
}

async function get(path: string, params: object | undefined, signal?: AbortSignal) {
  try {
    const res = await http.get(path, { params, signal });
    return res.data as { data: unknown; meta?: unknown };
  } catch (err) {
    if (signal?.aborted) throw err; // cancelled by react-query, not a failure
    throw toApiError(err);
  }
}

const delay = <T>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const clean = (p: object) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''));

/* -------------------------------- mocks --------------------------------- */

function mockServicesPage(p: ServicesParams): ServicesPage {
  const page = p.page ?? 1;
  const limit = p.limit ?? 12;
  const q = p.q?.trim().toLowerCase();

  let items = mockServices.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q) && !s.category.name.toLowerCase().includes(q)) return false;
    if (p.category && s.category.slug !== p.category && s.category.id !== p.category) return false;
    if (p.rating != null && s.rating < p.rating) return false;
    if (p.minPrice != null && s.basePrice < p.minPrice) return false;
    if (p.maxPrice != null && s.basePrice > p.maxPrice) return false;
    if (p.duration != null && s.durationMinutes > p.duration) return false;
    if (p.availability && s.availability !== p.availability) return false;
    return true;
  });

  items = [...items];
  if (p.sort === 'price-asc') items.sort((a, b) => a.basePrice - b.basePrice);
  else if (p.sort === 'price-desc') items.sort((a, b) => b.basePrice - a.basePrice);
  else if (p.sort === 'rating') items.sort((a, b) => b.rating - a.rating);
  else items.sort((a, b) => b.ratingCount - a.ratingCount); // popular (default)

  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/* --------------------------------- API ---------------------------------- */

export const publicApi = {
  /** GET /categories */
  async getCategories(signal?: AbortSignal): Promise<Category[]> {
    if (USE_MOCKS) return delay([...mockCategories].sort((a, b) => a.sortOrder - b.sortOrder));
    const body = await get('/categories', undefined, signal);
    return parse(categoriesSchema, body.data, 'GET /categories');
  },

  /** GET /services */
  async getServices(params: ServicesParams = {}, signal?: AbortSignal): Promise<ServicesPage> {
    if (USE_MOCKS) return delay(mockServicesPage(params));
    const body = await get('/services', clean(params), signal);
    return parse(servicesPageSchema, { items: body.data, meta: body.meta }, 'GET /services');
  },

  /** GET /services/:slug */
  async getService(slug: string, signal?: AbortSignal): Promise<ServiceDetail> {
    if (USE_MOCKS) {
      const found = mockServiceDetails.find((s) => s.slug === slug || s.id === slug);
      if (!found) throw new ApiError('not_found', MESSAGES.not_found, 404);
      return delay(found);
    }
    const body = await get(`/services/${encodeURIComponent(slug)}`, undefined, signal);
    return parse(serviceDetailSchema, body.data, 'GET /services/:slug');
  },

  /** GET /services/:id/reviews */
  async getServiceReviews(serviceId: string, params: ReviewsParams = {}, signal?: AbortSignal): Promise<ReviewsPage> {
    const { page = 1, limit = 10 } = params;
    if (USE_MOCKS) return delay(mockReviewsFor(serviceId, page, limit));
    const body = await get(`/services/${encodeURIComponent(serviceId)}/reviews`, { page, limit }, signal);
    const data = (body.data ?? {}) as { summary?: unknown; reviews?: unknown };
    return parse(
      reviewsPageSchema,
      { summary: data.summary, reviews: data.reviews, meta: body.meta },
      'GET /services/:id/reviews',
    );
  },

  /** GET /banners?placement=home */
  async getBanners(placement: BannerPlacement = 'home', signal?: AbortSignal): Promise<Banner[]> {
    if (USE_MOCKS) return delay(mockBanners);
    const body = await get('/banners', { placement }, signal);
    return parse(bannersSchema, body.data, 'GET /banners');
  },
};
