import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import { bookingKeys } from "@/hooks/useBookings";
import type {
  BookingDetailView,
  CancelBookingResult,
  CancellationSummary,
  ExtraChargeDecision,
  RescheduleInput,
} from "@/types/bookingDetail";

/** Detail queries live under the same prefix as the list, so `invalidateQueries(bookingKeys.all)` refreshes both. */
export const bookingDetailKey = (id: string) =>
  [...bookingKeys.all, "detail", id] as const;

/** While the job is happening the page re-checks often: that is how the start code and extra charges appear. */
const LIVE_STATUSES: ReadonlySet<string> = new Set([
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
]);
const LIVE_REFRESH_MS = 15_000;

/** Network failures and 5xx are worth another try; 404 / 400 / 401 are answers, not glitches. */
const retryTransientOnly = (
  failureCount: number,
  error: NormalizedApiError,
): boolean => failureCount < 2 && (error.status === 0 || error.status >= 500);

/** One of the signed-in customer's own bookings. Someone else's booking surfaces as a 404 error. */
export function useBooking(id: string | undefined) {
  return useQuery<BookingDetailView, NormalizedApiError>({
    queryKey: bookingDetailKey(id ?? ""),
    queryFn: ({ signal }) => bookingApi.getBookingDetail(id as string, signal),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: retryTransientOnly,
    refetchInterval: (query) =>
      query.state.data && LIVE_STATUSES.has(query.state.data.status)
        ? LIVE_REFRESH_MS
        : false,
  });
}

interface DecideArgs {
  chargeId: string;
  decision: ExtraChargeDecision;
}

/** Approve or reject one extra charge. The reply is the refreshed booking, which replaces the cached one. */
export function useDecideExtraCharge(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation<BookingDetailView, NormalizedApiError, DecideArgs>({
    mutationFn: ({ chargeId, decision }) =>
      bookingApi.decideExtraCharge(bookingId, chargeId, decision),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingDetailKey(bookingId), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
    // A 409 means someone (or another tab) already decided: show the truth, not our stale copy.
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: bookingDetailKey(bookingId),
      });
    },
  });
}

/** The fee and refund if the customer cancelled now. Never cached: the fee depends on the clock. */
export function useCancelPreview(bookingId: string | undefined, enabled: boolean) {
  return useQuery<CancellationSummary, NormalizedApiError>({
    queryKey: [...bookingKeys.all, "cancel-preview", bookingId ?? ""],
    queryFn: ({ signal }) =>
      bookingApi.getCancelPreview(bookingId as string, signal),
    enabled: enabled && Boolean(bookingId),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: retryTransientOnly,
  });
}

/** Cancel the booking with a reason. The reply carries the refreshed booking, which replaces the cached one. */
export function useCancelBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation<CancelBookingResult, NormalizedApiError, string>({
    mutationFn: (reason) => bookingApi.cancelBooking(bookingId, reason),
    onSuccess: (result) => {
      queryClient.setQueryData(bookingDetailKey(bookingId), result.booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
    // A 409 means the booking moved on (another tab, the partner): show the truth, not our stale copy.
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: bookingDetailKey(bookingId),
      });
    },
  });
}

/** Move the booking to another date and slot. The reply is the refreshed booking. */
export function useRescheduleBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation<BookingDetailView, NormalizedApiError, RescheduleInput>({
    mutationFn: (input) => bookingApi.rescheduleBooking(bookingId, input),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingDetailKey(bookingId), booking);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: bookingDetailKey(bookingId),
      });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}
