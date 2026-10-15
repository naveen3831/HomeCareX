import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { customerPath } from "@/routes/customerPath";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import type { BookingView } from "@/types/booking";
import { ACTIVE_STATUSES, normalizeStatus, trackPath } from "./trackingModel";

/**
 * The old /customer/tracking URL (and its ?booking=<id> links). Sends the customer to
 * /customer/bookings/:id/track: the booking in the link, or else their latest active one.
 */
export default function TrackingRedirect() {
  const [params] = useSearchParams();
  const requested = params.get("booking");
  const online = useOnlineStatus();
  const { data, isLoading, isError, error, refetch } = useQuery<
    BookingView[],
    NormalizedApiError
  >({
    queryKey: ["customer-bookings"],
    queryFn: () => bookingApi.getBookings(),
    enabled: !requested,
  });

  if (requested) return <Navigate to={trackPath(requested)} replace />;

  const wrap = (children: React.ReactNode) => (
    <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
  );

  if (isLoading) return wrap(<LoadingState label="Finding your booking…" />);
  if (isError) {
    return wrap(
      online ? (
        <ErrorState
          title="Could not load your bookings"
          message={error?.message || "Failed to fetch your bookings."}
          onRetry={() => void refetch()}
        />
      ) : (
        <OfflineState onRetry={() => void refetch()} />
      ),
    );
  }

  const active = (data ?? []).find((b) =>
    ACTIVE_STATUSES.has(normalizeStatus(b.status)),
  );
  if (active) return <Navigate to={trackPath(active._id)} replace />;

  return wrap(
    <EmptyState
      title="No active booking to track"
      description="Once a partner is assigned to a booking, you can follow them here."
      action={
        <Link
          to={customerPath("/bookings")}
          className={clsx(
            "inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:opacity-90",
            FOCUS_RING,
          )}
        >
          My bookings
        </Link>
      }
    />,
  );
}
