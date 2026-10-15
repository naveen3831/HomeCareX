import type { ReactNode } from "react";
import { CalendarCheck, ChevronDown, UserRound } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { PendingReview } from "@/services/reviewsApi";
import BookingThumb from "@/pages/customer/Dashboard/sections/BookingThumb";
import { formatDate } from "../reviewModel";

interface Props {
  booking: PendingReview;
  open: boolean;
  onToggle: () => void;
  /** The review form, rendered under the summary while `open`. */
  children?: ReactNode;
}

/** A completed booking waiting for a review. "Write a review" opens the form right inside the card. */
export function PendingReviewCard({ booking, open, onToggle, children }: Props) {
  const panelId = `review-form-${booking.bookingId}`;
  return (
    <li id={`pending-${booking.bookingId}`} className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <BookingThumb serviceName={booking.serviceName} className="h-14 w-14 rounded-2xl border border-line" />
          <div className="min-w-0">
          <h3 className="break-words text-[15px] font-semibold text-ink">{booking.serviceName}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
              {booking.partnerName ?? "HomeCareX partner"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Completed <time dateTime={booking.completedOn}>{formatDate(booking.completedOn)}</time>
            </span>
          </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={clsx(
            "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors",
            open ? "border border-line bg-panel text-ink hover:bg-canvas" : "bg-brand text-white shadow-[0_8px_20px_-8px_rgba(67,56,202,.6)] hover:opacity-90",
            FOCUS_RING,
          )}
        >
          {open ? "Close" : "Write a review"}
          <span className="sr-only"> for {booking.serviceName}</span>
          <ChevronDown aria-hidden="true" className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && <div id={panelId}>{children}</div>}
    </li>
  );
}
