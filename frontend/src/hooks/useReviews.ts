import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingKeys } from "@/hooks/useBookings";
import type { NormalizedApiError } from "@/services/bookingApi";
import {
  createBookingReview,
  fetchMyBookingReviews,
  fetchPendingReviews,
  type CreateBookingReviewInput,
  type MyReview,
  type PendingReview,
} from "@/services/reviewsApi";

export const reviewKeys = {
  all: ["customer-reviews"] as const,
  mine: ["customer-reviews", "mine"] as const,
  pending: ["customer-reviews", "pending"] as const,
};

/** Network blips and 5xx are worth a retry; a 4xx will not fix itself. */
const retryReads = (failureCount: number, error: NormalizedApiError): boolean =>
  failureCount < 2 && (error.status === 0 || error.status >= 500);

/** The two lists on /customer/reviews: bookings waiting for a review, and the reviews already written. */
export function useReviews() {
  const pending = useQuery<PendingReview[], NormalizedApiError>({
    queryKey: reviewKeys.pending,
    queryFn: ({ signal }) => fetchPendingReviews(signal),
    staleTime: 30_000,
    retry: retryReads,
  });
  const mine = useQuery<MyReview[], NormalizedApiError>({
    queryKey: reviewKeys.mine,
    queryFn: ({ signal }) => fetchMyBookingReviews(signal),
    staleTime: 30_000,
    retry: retryReads,
  });
  return { pending, mine };
}

/** The reviews the signed-in customer already wrote (shared cache with the Reviews page). */
export function useMyReviews(enabled = true) {
  return useQuery<MyReview[], NormalizedApiError>({
    queryKey: reviewKeys.mine,
    queryFn: ({ signal }) => fetchMyBookingReviews(signal),
    enabled,
    staleTime: 30_000,
    retry: retryReads,
  });
}

export interface CreateReviewVariables extends CreateBookingReviewInput {
  bookingId: string;
}

/**
 * POST /bookings/:id/review. On success the booking leaves "Pending" and the review appears under "My reviews".
 * A 409 (already reviewed) also refreshes the lists, so the stale card disappears.
 */
export function useCreateReview() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  };
  return useMutation<MyReview, NormalizedApiError, CreateReviewVariables>({
    mutationFn: ({ bookingId, ...input }) => createBookingReview(bookingId, input),
    onSuccess: refresh,
    onError: (error) => {
      if (error.status === 409 || error.status === 404) refresh();
    },
  });
}
