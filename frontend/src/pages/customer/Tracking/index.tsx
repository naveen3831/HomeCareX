import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Radio,
  RefreshCw,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useBooking, bookingDetailKey } from "@/hooks/useBooking";
import { useNow } from "@/hooks/useNow";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTracking } from "@/hooks/useTracking";
import { customerPath } from "@/routes/customerPath";
import { isCancelledStatus } from "../BookingDetails/bookingDetailModel";
import { formatRating } from "../Bookings/bookingModel";
import BookingChat from "./components/BookingChat";
import EtaBadge from "./components/EtaBadge";
import LiveMap from "./components/LiveMap";
import PartnerCard from "./components/PartnerCard";
import StatusTimeline from "./components/StatusTimeline";
import {
  ACTIVE_STATUSES,
  buildTrackingSteps,
  formatAgo,
  formatBookedOn,
  formatDistance,
  locationFreshness,
  normalizeStatus,
  resolveDestinationPoint,
  resolveDistanceKm,
  resolveEtaMinutes,
  resolvePartnerPoint,
  statusHeadline,
  statusLabel,
} from "./trackingModel";

const CHAT_ID = "tracking-chat";
const CARD =
  "rounded-2xl border border-line bg-panel p-3.5 shadow-sm lg:px-[18px] lg:py-3";
const BACK_LINK =
  "inline-flex min-h-[24px] items-center gap-1.5 rounded-lg text-xs font-semibold text-brand hover:underline";

const BADGE_STYLE: Record<string, string> = {
  assigned: "bg-brand-soft text-brand",
  en_route: "bg-emerald-50 text-emerald-700",
  arrived: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  rated: "bg-emerald-50 text-emerald-700",
};

function StatusIcon({ status }: { status: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (status === "en_route")
    return <Truck className={cls} aria-hidden="true" />;
  if (status === "in_progress")
    return <Wrench className={cls} aria-hidden="true" />;
  if (status === "assigned")
    return <UserCheck className={cls} aria-hidden="true" />;
  if (status === "arrived" || status === "completed" || status === "rated")
    return <CheckCircle2 className={cls} aria-hidden="true" />;
  return <Clock className={cls} aria-hidden="true" />;
}

const scrollTo = (el: HTMLElement | null) => {
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

/** /customer/bookings/:id/track: where the partner is, who they are, and how far along the job is. */
export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const booking = useBooking(id);
  const tracking = useTracking(id);
  const now = useNow(30_000);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const mapSection = useRef<HTMLElement>(null);
  const [focusPartnerKey, setFocusPartnerKey] = useState(0);
  const [focusedOnPartner, setFocusedOnPartner] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFocusKey, setChatFocusKey] = useState(0);

  // Reset chat visibility when switching bookings
  useEffect(() => {
    setChatOpen(false);
    setChatFocusKey(0);
  }, [id]);

  // Focus and scroll to the chat panel once it mounts after clicking the Chat button
  useEffect(() => {
    if (!chatOpen || chatFocusKey === 0) return;
    const raf = window.requestAnimationFrame(() => {
      const chat = document.getElementById(CHAT_ID);
      if (window.innerWidth < 1024) {
        scrollTo(chat);
      }
      const input = chat?.querySelector<HTMLElement>("textarea, input");
      (input ?? chat)?.focus({
        preventScroll: window.innerWidth >= 1024,
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [chatOpen, chatFocusKey]);

  // Dynamically measure exact available height inside the customer dashboard layout on desktop.
  useLayoutEffect(() => {
    const el = pageShellRef.current;
    if (!el) return;

    const updateAvailableHeight = () => {
      if (window.innerWidth < 1024) {
        el.style.removeProperty("--tk-viewport-h");
        return;
      }
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      const parentPadBottom = parent
        ? parseFloat(window.getComputedStyle(parent).paddingBottom) || 0
        : 0;
      const topOffset = Math.max(0, Math.round(rect.top));
      const available = Math.max(
        540,
        Math.floor(window.innerHeight - topOffset - parentPadBottom),
      );
      el.style.setProperty("--tk-viewport-h", `${available}px`);
    };

    updateAvailableHeight();
    window.addEventListener("resize", updateAvailableHeight);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateAvailableHeight)
        : null;
    if (observer && el.parentElement) observer.observe(el.parentElement);

    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      observer?.disconnect();
    };
  }, [booking.data, tracking.status, tracking.location, chatOpen]);

  // The socket moves the timeline at once; the booking itself (partner details, history) is re-fetched behind it.
  const previousStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = tracking.status;
    if (
      id &&
      status &&
      previousStatus.current &&
      previousStatus.current !== status
    ) {
      void queryClient.invalidateQueries({ queryKey: bookingDetailKey(id) });
    }
    if (status) previousStatus.current = status;
  }, [id, tracking.status, queryClient]);

  const detailsHref = id
    ? customerPath(`/bookings/${encodeURIComponent(id)}`)
    : customerPath("/bookings");

  const stateShell = (children: ReactNode) => (
    <div
      ref={pageShellRef}
      className="tk-page-shell mx-auto w-full max-w-6xl px-3 py-4 sm:px-5"
    >
      {children}
    </div>
  );

  if (!id) {
    return stateShell(
      <EmptyState
        title="No booking selected"
        description="Open one of your bookings to track it."
        action={
          <Link
            to={customerPath("/bookings")}
            className={clsx(BACK_LINK, FOCUS_RING)}
          >
            My bookings
          </Link>
        }
      />,
    );
  }

  if (booking.isLoading) {
    return stateShell(<LoadingState label="Loading your booking…" />);
  }

  const data = booking.data;
  if (!data) {
    if (!online) {
      return stateShell(
        <OfflineState onRetry={() => void booking.refetch()} />,
      );
    }
    if (booking.error?.status === 404) {
      return stateShell(
        <EmptyState
          title="We couldn't find this booking"
          description="It may have been removed, or it belongs to another account."
          action={
            <Link
              to={customerPath("/bookings")}
              className={clsx(BACK_LINK, FOCUS_RING)}
            >
              My bookings
            </Link>
          }
        />,
      );
    }
    return stateShell(
      <ErrorState
        title="Could not load this booking"
        message={booking.error?.message || "Failed to fetch the booking."}
        onRetry={() => void booking.refetch()}
      />,
    );
  }

  const status = normalizeStatus(tracking.status ?? data.status);
  const cancelled = isCancelledStatus(status) || status === "disputed";
  const finished = status === "completed" || status === "rated";
  const trackable = ACTIVE_STATUSES.has(status) && !cancelled;
  const hasPartner =
    Boolean(data.partnerId) ||
    Boolean(data.partner) ||
    tracking.partnerAssigned;

  const destination = resolveDestinationPoint(data, tracking);
  const partnerPoint = resolvePartnerPoint(tracking.location, data, tracking);
  const freshness = locationFreshness(tracking.location, now, partnerPoint);
  const km = resolveDistanceKm(
    partnerPoint,
    destination,
    tracking.location,
    data,
    tracking,
  );
  const eta = resolveEtaMinutes(km, status, tracking.location, data, tracking);
  const distanceText = km !== null ? formatDistance(km) : null;
  const ago = formatAgo(tracking.location?.updatedAt, now);

  const mapSummary =
    km !== null
      ? `Your partner is about ${formatDistance(km)} from your address.`
      : partnerPoint
        ? "Your partner's last known position."
        : "Your address.";

  // The small card on the map
  const onSite = status === "in_progress";
  const travelDetails = [
    distanceText ? `${distanceText} away` : null,
    eta !== null ? `ETA ~${eta} min` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  let overlayTitle: string | null = null;
  let overlayText: string | null = null;
  if (!destination && !partnerPoint) {
    overlayTitle = "Address location unavailable";
    overlayText = "This booking's address has no map coordinates.";
  } else if (onSite) {
    overlayTitle = "Service in progress";
    overlayText = "Your partner is at your location.";
  } else if (focusedOnPartner && partnerPoint) {
    overlayTitle = "Partner's last known location";
    overlayText = [
      ago ? `Updated ${ago}` : null,
      travelDetails ||
        `${partnerPoint.lat.toFixed(4)}, ${partnerPoint.lng.toFixed(4)}`,
    ]
      .filter(Boolean)
      .join(" • ");
  } else if (freshness === "live" && status === "en_route" && eta !== null) {
    overlayTitle = "Partner arriving";
    overlayText = `Reach your location in ${eta} min${distanceText ? ` (${distanceText})` : ""}`;
  } else if (freshness === "live" && status === "arrived") {
    overlayTitle = "Partner arrived";
    overlayText = "Your partner is at your location.";
  } else if (freshness === "last_known") {
    overlayTitle = "Live location unavailable";
    overlayText = [
      "Showing last known position",
      ago ? `Updated ${ago}` : null,
      travelDetails,
    ]
      .filter(Boolean)
      .join(" • ");
  } else if (freshness === "none" && trackable) {
    overlayTitle = "Live location unavailable";
    overlayText =
      status === "assigned"
        ? "Your partner hasn't set off yet."
        : `Latest status: ${statusLabel(status)}.`;
  }

  const connection = !online
    ? "You're offline. Live updates will resume when you're back online."
    : tracking.phase === "live"
      ? "Live updates are on."
      : tracking.phase === "reconnecting"
        ? "Reconnecting to live updates. Showing the latest information we have."
        : tracking.phase === "connecting"
          ? "Connecting to live updates…"
          : tracking.phase === "denied"
            ? "Live tracking isn't available for this booking."
            : "Live updates are unavailable right now. Showing the latest saved status.";

  // When the position is not live, say so plainly and keep the latest status visible.
  const locationUnavailable = freshness !== "live";
  const connectionIssue = !online || tracking.phase !== "live";
  const unavailableDetail =
    freshness === "last_known"
      ? `Last known status: ${statusLabel(status)}.${ago ? ` Position updated ${ago}.` : ""}`
      : `Latest status: ${statusLabel(status)}.`;

  const showRetry =
    (tracking.phase === "error" || tracking.phase === "reconnecting") && online;

  const bookingCode = data.bookingNumber || `BK-${id.slice(-6).toUpperCase()}`;
  const bookedOn = formatBookedOn(data.statusHistory?.[0]?.at);
  const serviceName = data.service?.name || data.serviceName;

  const bookedAtIso = data.statusHistory?.[0]?.at;
  const steps = buildTrackingSteps(status, data.statusHistory).map((step) =>
    step.key === "confirmed" && !step.at && step.state !== "upcoming"
      ? { ...step, at: bookedAtIso }
      : step,
  );

  const partner = data.partner;
  const partnerRating = formatRating(partner?.rating);
  // Real code only: no invented "PX1001" fallback.
  const partnerCode = data.partnerId
    ? `PX${String(data.partnerId).slice(-4).toUpperCase()}`
    : null;
  const showFallbackNotice = trackable && freshness !== "live";
  const showChatCard = trackable && hasPartner && chatOpen;

  const handleViewLastKnownLocation = () => {
    if (window.innerWidth < 1024) {
      scrollTo(mapSection.current);
    }
    setFocusedOnPartner(true);
    setFocusPartnerKey((prev) => prev + 1);
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setChatFocusKey((prev) => prev + 1);
  };

  const retryButton = showRetry && (
    <button
      type="button"
      onClick={tracking.retry}
      className={clsx(
        "inline-flex min-h-[24px] shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold text-brand hover:underline",
        FOCUS_RING,
      )}
    >
      <RefreshCw className="h-3 w-3" aria-hidden="true" />
      Try again
    </button>
  );

  return (
    <div
      ref={pageShellRef}
      className={clsx(
        "tk-page-shell mx-auto w-full max-w-6xl px-3 py-1 sm:px-5",
        trackable && "tk-page-shell--fit",
      )}
    >
      <div
        className={clsx(
          "min-w-0",
          trackable
            ? clsx(
                "tk-page-grid",
                !showFallbackNotice && "tk-page-grid--no-banner",
              )
            : "space-y-4",
        )}
      >
        {/* ---------- header ---------- */}
        <header className="tk-header flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={detailsHref} className={clsx(BACK_LINK, FOCUS_RING)}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to booking
              </Link>
              <span aria-hidden="true" className="text-xs text-slate-300">
                |
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                <Radio className="h-3 w-3" aria-hidden="true" />
                Live Tracking
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="break-words text-lg font-bold leading-snug tracking-tight text-ink sm:text-xl">
                {serviceName || "Track your service"}
              </h1>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span>Booking ID {bookingCode}</span>
                {bookedOn && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>Booked on {bookedOn}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {!cancelled && (
            <div className="flex items-center gap-2.5 sm:flex-col sm:items-end sm:gap-0.5">
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold sm:text-[13px]",
                  BADGE_STYLE[status] ?? "bg-slate-100 text-slate-700",
                )}
              >
                <StatusIcon status={status} />
                {statusLabel(status)}
              </span>
              <EtaBadge status={status} minutes={eta} />
            </div>
          )}
        </header>

        {/* ---------- not trackable: say why ---------- */}
        {!trackable && (
          <section aria-labelledby="tk-status-title" className={CARD}>
            <h2
              id="tk-status-title"
              aria-live="polite"
              className="text-base font-semibold text-ink"
            >
              {cancelled
                ? "This booking is not active"
                : statusHeadline(status)}
            </h2>
            <p role="status" className="mt-1 text-xs text-muted">
              {connection}
            </p>
            {retryButton}
            {!cancelled && !finished && (
              <p className="mt-2 text-sm text-muted">
                Live tracking starts once a partner is assigned to your booking.
              </p>
            )}
            {(cancelled || finished) && (
              <p className="mt-2 text-sm text-muted">
                {cancelled
                  ? "Live tracking isn't available for a cancelled booking."
                  : "The partner has finished, so there is nothing left to track."}{" "}
                <Link
                  to={detailsHref}
                  className={clsx(
                    "font-semibold text-brand hover:underline",
                    FOCUS_RING,
                  )}
                >
                  View booking details
                </Link>
              </p>
            )}
          </section>
        )}

        {/* ---------- middle row: map + partner (equal-height cards) ---------- */}
        {trackable && (
          <div className="tk-main-grid">
            <section
              ref={mapSection}
              aria-label="Live map"
              className="tk-map-section min-h-0 min-w-0"
            >
              <LiveMap
                destination={destination}
                partner={partnerPoint}
                stale={freshness === "last_known"}
                summary={mapSummary}
                partnerName={partner?.name?.trim() || "Partner"}
                partnerRating={partnerRating || null}
                partnerPhoto={partner?.avatar ?? null}
                overlayTitle={overlayTitle}
                overlayText={overlayText}
                updatedLabel={
                  freshness === "live"
                    ? "Live location available"
                    : ago
                      ? `Last updated ${ago}`
                      : null
                }
                focusPartnerKey={focusPartnerKey}
                onResetFocus={() => setFocusedOnPartner(false)}
              />
            </section>

            <section
              aria-labelledby="tk-partner-title"
              className="tk-partner-card tk-partner-section"
            >
              <h2
                id="tk-partner-title"
                className="shrink-0 text-[13px] font-semibold leading-none text-ink"
              >
                Service Partner
              </h2>

              <PartnerCard
                partner={partner}
                hasPartner={hasPartner}
                serviceTitle={serviceName}
                partnerCode={partnerCode}
                etaMinutes={eta}
                distanceText={distanceText}
                showTravel={!onSite}
                detailsHref={detailsHref}
                chatOpen={chatOpen}
                onChat={handleOpenChat}
              />

              <div
                role="status"
                className={clsx(
                  "mt-auto flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5",
                  locationUnavailable
                    ? "border-amber-200/80 bg-amber-50/80"
                    : "border-emerald-200/80 bg-emerald-50/80",
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "h-2 w-2 shrink-0 rounded-full",
                    locationUnavailable ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold leading-tight text-ink">
                    {freshness === "live"
                      ? onSite
                        ? "Partner is at your location"
                        : "Live Location"
                      : freshness === "last_known"
                        ? "Last known location"
                        : "Location not shared yet"}
                  </p>
                  <p className="truncate text-[10.5px] font-medium leading-tight text-slate-600">
                    {locationUnavailable && !connectionIssue
                      ? unavailableDetail
                      : connection}
                  </p>
                </div>
                {retryButton}
              </div>
            </section>
          </div>
        )}

        {/* ---------- bottom row: timeline on left + reserved space on right for chat ---------- */}
        <div
          className={clsx(
            trackable && hasPartner
              ? "tracking-bottom tk-bottom-grid"
              : "grid min-w-0 gap-4",
          )}
        >
          <section
            aria-labelledby="tk-progress-title"
            className="booking-status-card tk-timeline-section"
          >
            <div className="tk-card-header">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                >
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <h2
                  id="tk-progress-title"
                  className="truncate text-[15px] font-semibold leading-tight text-ink"
                >
                  Booking Status
                </h2>
              </div>
              {trackable && (
                <p
                  aria-live="polite"
                  className="truncate text-xs font-medium text-brand"
                >
                  {statusHeadline(status)}
                </p>
              )}
            </div>

            <div className="tk-timeline-body">
              {cancelled ? (
                <p className="text-sm text-muted">
                  This booking was stopped, so there is no progress to show.
                </p>
              ) : (
                <StatusTimeline items={steps} />
              )}
            </div>
          </section>

          {showChatCard ? (
            <BookingChat
              id={CHAT_ID}
              bookingId={id}
              onClose={() => setChatOpen(false)}
            />
          ) : (
            trackable &&
            hasPartner && (
              <div
                aria-hidden="true"
                className="hidden min-h-0 min-w-0 md:block"
              />
            )
          )}
        </div>

        {/* ---------- bottom notice: location fallback ---------- */}
        {showFallbackNotice && (
          <section
            role="status"
            className="tk-fallback-banner flex flex-wrap items-center gap-3 rounded-xl border border-brand/15 bg-brand-soft/45 px-3.5 py-1.5"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-white"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xs font-semibold text-ink">
                Live location unavailable
              </p>
              <p className="text-xs text-muted">
                {freshness === "none"
                  ? status === "assigned"
                    ? "Your partner hasn't set off yet. You'll see them on the map as soon as they do."
                    : `Latest status: ${statusLabel(status)}.`
                  : `Showing the last known location.${ago ? ` Updated ${ago}.` : ""}${distanceText ? ` Distance: ${distanceText}.` : ""}${eta !== null ? ` Est. travel: ~${eta} min.` : ""} Latest status: ${statusLabel(status)}.`}
              </p>
            </div>
            {freshness === "last_known" && (
              <button
                type="button"
                onClick={handleViewLastKnownLocation}
                className={clsx(
                  "inline-flex min-h-[28px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition",
                  focusedOnPartner
                    ? "border-brand bg-brand text-white hover:opacity-95"
                    : "border-brand/40 bg-white text-brand hover:bg-brand-soft",
                  FOCUS_RING,
                )}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {focusedOnPartner
                  ? "Viewing Last Known Location"
                  : "View Last Known Location"}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
