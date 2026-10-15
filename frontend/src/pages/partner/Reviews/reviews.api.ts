import type { PageMeta, PartnerReview, ReviewSummary, ReviewsPage } from './reviews.types';

/*
 * ADAPT THIS FILE ONLY. Everything else in this folder is independent of how the app talks to the backend.
 * Make `API_BASE` and `authHeader()` match what performance.api.ts uses (same base URL, same token source).
 * If the project already has an API client (axios instance etc.), call it inside `get` instead of fetch.
 * A wrong token or URL fails safely: the page shows its error state with a Retry button.
 */
const API_BASE = '/api/v1';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

interface ErrorEnvelope {
  message?: string;
  code?: string;
}

export class ReviewsApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ReviewsApiError';
    this.status = status;
    this.code = code;
  }
}

async function get<T>(path: string, signal: AbortSignal): Promise<SuccessEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json', ...authHeader() }, signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ReviewsApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body ?? {}) as ErrorEnvelope;
    throw new ReviewsApiError(e.message ?? `Request failed (${res.status})`, res.status, e.code);
  }
  return body as SuccessEnvelope<T>;
}

export async function fetchReviewSummary(signal: AbortSignal): Promise<ReviewSummary> {
  return (await get<ReviewSummary>('/partner/reviews/summary', signal)).data;
}

export async function fetchReviews(page: number, limit: number, signal: AbortSignal): Promise<ReviewsPage> {
  const res = await get<PartnerReview[]>(`/partner/reviews?page=${page}&limit=${limit}`, signal);
  const meta = res.meta ?? { page, limit, total: res.data.length, totalPages: 1 };
  return { reviews: res.data, meta };
}