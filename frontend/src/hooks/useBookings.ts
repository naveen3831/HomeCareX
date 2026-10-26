import { useQuery } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { retryTransient } from "@/services/catalogApi";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import type {
  BookingListParams,
  BookingPage,
  BookingSort,
  BookingTab,
} from "@/types/bookingList";

/**
 * Every customer-bookings query lives under this prefix, so one
 * `invalidateQueries({ queryKey: ["customer-bookings"] })` (as usePayBooking does) refreshes them all.
 */
export const bookingKeys = {
  all: ["customer-bookings"] as const,
  list: (params: BookingListParams) =>
    ["customer-bookings", "list", params] as const,
};

export interface UseBookingsParams {
  tab: BookingTab;
  /**
   * Narrows the tab to one status (the Status filter). It must be one of the tab's own statuses,
   * the page only offers those. Left out, the whole tab is returned.
   */
  status?: string;
  search?: string;
  date?: string;
  service?: string;
  sort?: BookingSort;
  page: number;
  limit: number;
}

/** Open service views also change when a scheduled window or payment hold ends. */
const REFRESH_MS = 30_000;

/**
 * One page of the customer's bookings for a tab and its filters.
 *
 * The previous page stays on screen (`isPlaceholderData`) while the next one loads, so switching
 * page or filter never flashes an empty or skeleton list. Reset `page` to 1 whenever the tab,
 * search or any filter changes.
 */
export function useBookings(params: UseBookingsParams) {
  const online = useOnlineStatus();
  const { tab, status, ...rest } = params;
  const request: BookingListParams = { ...rest, tab, status: status ?? tab };

  return useQuery<BookingPage, NormalizedApiError>({
    queryKey: bookingKeys.list(request),
    queryFn: ({ signal }) => bookingApi.listBookings(request, signal),
    // Keep pagination smooth, but never show another tab's cards during a tab change.
    placeholderData: (previousData, previousQuery) => {
      const previous = previousQuery?.queryKey[2] as
        | BookingListParams
        | undefined;
      return previous?.tab === tab ? previousData : undefined;
    },
    staleTime: 15_000,
    enabled: online,
    retry: retryTransient,
    refetchInterval:
      online && (tab === "live" || tab === "upcoming")
        ? REFRESH_MS
        : false,
    refetchOnReconnect: true,
  });
}
