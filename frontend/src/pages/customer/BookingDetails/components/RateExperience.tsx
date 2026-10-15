import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useMyReviews } from "@/hooks/useReviews";
import { customerPath } from "@/routes/customerPath";
import { StarRatingDisplay } from "@/pages/customer/Reviews/components/StarRating";
import { RATING_LABELS } from "@/pages/customer/Reviews/reviewModel";

const BUTTON = "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-panel px-4 text-sm font-semibold text-brand transition hover:opacity-90";

/**
 * "Rate your experience" block inside Booking Actions, right above Book Again.
 * Rated: shows the stars the customer gave (and their comment). Finished but not rated: a Write a Review link.
 * Not finished yet: a disabled button. Renders nothing for a cancelled booking.
 */
export default function RateExperience({ bookingId, status }: { bookingId: string; status: string }) {
  const rated = status === "rated";
  const finished = status === "completed" || rated;
  const mine = useMyReviews(rated);
  const review = rated ? mine.data?.find((r) => r.bookingId === bookingId) : undefined;

  return (
    <div className="rounded-xl border border-line bg-canvas/60 p-3.5" aria-label="Rate your experience">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <Star className="h-4 w-4 text-brand" aria-hidden="true" />
        Rate Your Experience
      </p>

      {rated ? (
        <>
          {review ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <StarRatingDisplay rating={review.rating} size={18} />
              <span className="text-sm font-semibold text-ink">
                {review.rating}/5 · {RATING_LABELS[review.rating]}
              </span>
            </div>
          ) : (
            mine.isPending && <p className="mt-2 text-xs text-muted">Loading your rating…</p>
          )}
          {review?.comment && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-ink/80">{review.comment}</p>}
          <p className="mt-2 text-sm text-muted">Thanks for rating this service.</p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-muted">{finished ? "How was your service?" : "You can review once the service is completed."}</p>
          {finished ? (
            <Link to={customerPath("/reviews")} className={clsx(BUTTON, "mt-3", FOCUS_RING)}>
              Write a Review
            </Link>
          ) : (
            <button type="button" disabled className={clsx(BUTTON, "mt-3 opacity-50")}>
              Write a Review
            </button>
          )}
        </>
      )}
    </div>
  );
}
