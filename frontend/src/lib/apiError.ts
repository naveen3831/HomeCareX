
import type { ApiError } from './http';

export type ApiErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'http'
  | 'unknown';

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  message: string;
  details?: { field: string; message: string }[];
}

/**
 * Accepts both normalized ApiError objects and raw Axios-style errors.
 */
function normalizeRaw(err: unknown): ApiError | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }

  const error = err as Record<string, unknown>;

  const response = error.response as
    | {
        status?: unknown;
        data?: Record<string, unknown>;
      }
    | undefined;

  if (
    typeof error.status !== 'number' &&
    response &&
    typeof response.status === 'number'
  ) {
    const data = response.data ?? {};

    return {
      ...error,
      status: response.status,
      code: error.code ?? data.code,
      message: error.message ?? data.message,
      details: error.details ?? data.details,
    } as ApiError;
  }

  return err as ApiError;
}

/**
 * Classifies frontend API errors into distinct categories:
 * - offline: browser reports that it is offline
 * - network: backend is unreachable or no HTTP response was received
 * - timeout: request exceeded its timeout
 * - http: an HTTP status response was received
 * - unknown: an unrecognized or unexpected error
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
      message:
        'Unable to connect to the server. Please check your internet connection.',
    };
  }

  // Normalize raw Axios errors before classifying them.
  const apiErr = normalizeRaw(err);

  if (!apiErr) {
    return {
      kind: 'unknown',
      message: 'Something went wrong. Please try again.',
    };
  }

  const normalized: ApiError = {
    message: apiErr.message || defaultHttpMsg,
    status: apiErr.status,
    code: apiErr.code,
    isTimeout: apiErr.isTimeout,
    details: apiErr.details,
  };

  // 2. Request timeout
  if (
    normalized.isTimeout ||
    normalized.code === 'ECONNABORTED' ||
    normalized.code === 'ETIMEDOUT' ||
    (typeof normalized.message === 'string' &&
      /taking too long|timeout|timed out/i.test(normalized.message))
  ) {
    return {
      kind: 'timeout',
      code: normalized.code,
      message:
        'The server is taking too long to respond. Please check your connection and try again.',
    };
  }

  // 3. HTTP response received
  if (
    typeof normalized.status === 'number' &&
    normalized.status > 0
  ) {
    return {
      kind: 'http',
      status: normalized.status,
      code: normalized.code,
      message: normalized.message || defaultHttpMsg,
      details: normalized.details,
    };
  }

  // 4. Network error without an HTTP response
  if (
    normalized.code === 'ERR_NETWORK' ||
    normalized.code === 'ECONNREFUSED' ||
    normalized.code === 'ERR_CONNECTION_REFUSED' ||
    !normalized.status
  ) {
    return {
      kind: 'network',
      code: normalized.code,
      message:
        'Unable to connect to the server. Please check your connection and try again.',
    };
  }

  // 5. Unexpected error
  return {
    kind: 'unknown',
    code: normalized.code,
    message: normalized.message || 'Something went wrong. Please try again.',
  };
}
