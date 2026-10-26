import axios, { type AxiosError } from 'axios';
import http from '@/lib/http';
import type { PageMeta, PartnerReview, ReviewSummary, ReviewsPage } from './reviews.types';

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
  try {
    const res = await http.get<SuccessEnvelope<T>>(path, { signal });
    return res.data;
  } catch (err) {
    if (axios.isCancel(err) || signal.aborted) throw err;

    // The shared client may hand back a raw axios error or its own normalised error
    // ({ status, code, message }). Read the status from whichever shape arrives, so a 403 is
    // not reported as "could not reach the server".
    const e = err as Partial<AxiosError<ErrorEnvelope>> & {
      status?: number;
      statusCode?: number;
      code?: string;
      message?: string;
    };
    const status = e.response?.status ?? e.status ?? e.statusCode ?? 0;
    const serverMessage = e.response?.data?.message ?? (status > 0 ? e.message : undefined);

    throw new ReviewsApiError(
      serverMessage ??
        (status > 0 ? `Request failed (${status})` : 'Could not reach the server. Check your connection and try again.'),
      status,
      e.response?.data?.code ?? (typeof e.code === 'string' ? e.code : undefined),
    );
  }
}

export async function fetchReviewSummary(signal: AbortSignal): Promise<ReviewSummary> {
  return (await get<ReviewSummary>('/partner/reviews/summary', signal)).data;
}

export async function fetchReviews(page: number, limit: number, signal: AbortSignal): Promise<ReviewsPage> {
  const res = await get<PartnerReview[]>(`/partner/reviews?page=${page}&limit=${limit}`, signal);
  const meta = res.meta ?? { page, limit, total: res.data.length, totalPages: 1 };
  return { reviews: res.data, meta };
}