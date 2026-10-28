import type { ApiError } from './http';

export type ApiErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'unknown';

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  message: string;
  details?: { field: string; message: string }[];
}

/**
 * Accepts both the normalized ApiError (status/code/message at the top level) and a raw axios-style
 * error ({ response: { status, data: { code, message, details } } }), and returns the former.
 */
function normalizeRaw(err: unknown): ApiError | undefined {
  if (!err || typeof err !== 'object') return err as ApiError | undefined;
  const e = err as Record<string, unknown>;
  const res = e.response as { status?: unknown; data?: Record<string, unknown> } | undefined;
  if (typeof e.status !== 'number' && res && typeof res.status === 'number') {
    const data = res.data ?? {};
    return {
      ...e,
      status: res.status,
      code: e.code ?? data.code,
      message: e.message ?? data.message,
      details: e.details ?? data.details,
    } as ApiError;
  }
  return err as ApiError;
}

/**
 * Classifies frontend API errors into distinct categories:
 * - 'offline': browser network adapter is disconnected (navigator.onLine === false)
 * - 'network': backend is unreachable, refused connection, or CORS failure (error.response == null)
 * - 'timeout': request exceeded client timeout (ECONNABORTED / ETIMEDOUT)
 * - 'http': actual HTTP status response received from backend (4xx, 5xx)
 * - 'unknown': unrecognized or unexpected runtime error
 */
export function classifyApiError(
  err: unknown,
  defaultHttpMsg = 'A server error occurred. Please try again shortly.',
): ClassifiedApiError {
  // 1. Browser offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      kind: 'offline',
      status: 0,
      message: 'Unable to connect to the server. Please check your internet connection.',
    };
  }

  const apiErr = err as (ApiError & { response?: { status?: number; data?: { message?: string; code?: string; details?: ApiError['details'] } } }) | undefined;
  const responseData = apiErr?.response?.data;
  const normalized: ApiError = {
    message: apiErr?.message || responseData?.message || defaultHttpMsg,
    status: apiErr?.status ?? apiErr?.response?.status,
    code: apiErr?.code || responseData?.code,
    isTimeout: apiErr?.isTimeout,
    details: apiErr?.details ?? responseData?.details,
  };

  if (!apiErr && !responseData) {
  const apiErr = normalizeRaw(err);
  if (!apiErr) {
    return {
      kind: 'unknown',
      message: 'Something went wrong. Please try again.',
    };
  }

  // 2. Request Timeout
  if (
    normalized.isTimeout ||
    normalized.code === 'ECONNABORTED' ||
    normalized.code === 'ETIMEDOUT' ||
    (typeof normalized.message === 'string' && /taking too long|timeout/i.test(normalized.message))
  ) {
    return {
      kind: 'timeout',
      code: normalized.code,
      message: 'The server is taking too long to respond. Please check your connection and try again.',
    };
  }

  // 3. HTTP status response received
  if (typeof normalized.status === 'number' && normalized.status > 0) {
    return {
      kind: 'http',
      status: normalized.status,
      code: normalized.code,
      message: normalized.message || defaultHttpMsg,
      details: normalized.details,
    };
  }

  // 4. Network error without HTTP status (server stopped, connection refused)
  return {
    kind: 'network',
    code: normalized.code,
    message: 'Unable to connect to the server. Please check your connection and try again.',
  };
}
