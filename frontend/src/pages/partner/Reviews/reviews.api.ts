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
    const e = err as AxiosError<ErrorEnvelope>;
    throw new ReviewsApiError(
      e.response?.data?.message ??
        (e.response ? `Request failed (${e.response.status})` : 'Could not reach the server. Check your connection and try again.'),
      e.response?.status ?? 0,
      e.response?.data?.code,
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