
import api from "@/lib/api";
import type {
  PerformanceSummary,
  PerformanceTrends,
} from "./performance.types";

function unwrap<T>(body: T | { data: T }): T {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body
  ) {
    return (body as { data: T }).data;
  }

  return body as T;
}

/**
 * Fetch the partner's overall performance scorecard.
 */
export async function fetchPerformance(): Promise<PerformanceSummary> {
  const response = await api.get<
    PerformanceSummary | { data: PerformanceSummary }
  >("/partner/performance");

  return unwrap(response.data);
}

/**
 * Fetch historical performance data for the trends chart.
 */
export async function fetchTrends(): Promise<PerformanceTrends> {
  const response = await api.get<
    PerformanceTrends | { data: PerformanceTrends }
  >("/partner/performance/trends");

  return unwrap(response.data);
}

/**
 * Extract a readable error message from an API error.
 */
export function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (typeof error === "object" && error !== null) {
    const message = (
      error as {
        response?: {
          data?: {
            message?: unknown;
          };
        };
      }
    ).response?.data?.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
