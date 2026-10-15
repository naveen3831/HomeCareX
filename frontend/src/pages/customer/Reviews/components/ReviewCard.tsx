import { Link } from "react-router-dom";
import { BadgeCheck, CalendarDays, UserRound } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { customerPath } from "@/routes/customerPath";
import type { MyReview } from "@/services/reviewsApi";
import BookingThumb from "@/pages/customer/Dashboard/sections/BookingThumb";
import { formatDate, STATUS_META } from "../reviewModel";
import { StarRatingDisplay } from "./StarRating";

/** One review the customer already wrote: stars, comment, tags and its validation status. */
export function ReviewCard({ review }: { review: MyReview }) {
  const status = STATUS_META[review.status] ?? STATUS_META.pending;
  const title = review.serviceName ?? "HomeCareX";

  return (
    <article className="px-4 py-5 sm:px-6" aria-label={`Your review of ${title}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3.5">
          <BookingThumb serviceName={title} className="h-14 w-14 rounded-2xl border border-line" />
          <div className="min-w-0">
          <h3 className="break-words text-[15px] font-semibold text-ink">{title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {review.partnerName && (
              <span className="inline-flex items-center gap-1">
                <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                {review.partnerName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            </span>
            {review.verified && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Verified booking
              </span>
            )}
          </div>
          </div>
        </div>
        <span title={status.hint} className={clsx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", status.className)}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <StarRatingDisplay rating={review.rating} />
        <span className="text-xs font-semibold tabular-nums text-ink">{review.rating}/5</span>
      </div>

      {review.tags.length > 0 && (
        <ul aria-label="Tags" className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {review.comment ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/90">{review.comment}</p>
      ) : (
        <p className="mt-3 text-sm italic text-muted">No written comment.</p>
      )}

      {review.bookingId && (
        <Link to={customerPath(`/bookings/${review.bookingId}`)} className={clsx("mt-3 inline-flex min-h-[40px] items-center rounded-lg text-sm font-semibold text-brand hover:underline", FOCUS_RING)}>
          View booking<span className="sr-only"> for {title}</span>
        </Link>
      )}
    </article>
  );
}
