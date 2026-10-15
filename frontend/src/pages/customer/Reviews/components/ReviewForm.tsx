import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Send } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { REVIEW_COMMENT_MAX, REVIEW_TAGS, type CreateBookingReviewInput, type PendingReview, type ReviewTag } from "@/services/reviewsApi";
import { StarRatingInput } from "./StarRating";

interface Props {
  booking: PendingReview;
  submitting: boolean;
  /** Server / network error from the last attempt, shown above the buttons. */
  error?: string;
  onSubmit: (input: CreateBookingReviewInput) => void;
  onCancel: () => void;
}

/**
 * Review form for one completed booking. The service and partner come from the booking (the server
 * ignores anything else), so they are shown read-only. Only the rating is required.
 */
export function ReviewForm({ booking, submitting, error, onSubmit, onCancel }: Props) {
  const uid = useId();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  const [ratingError, setRatingError] = useState("");
  const ratingRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // A failed send puts the message in front of keyboard / screen reader users.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const toggleTag = (tag: ReviewTag) => setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (rating < 1) {
      setRatingError("Please choose a star rating.");
      ratingRef.current?.querySelector<HTMLButtonElement>("[role=radio]")?.focus();
      return;
    }
    setRatingError("");
    // Send tags in the order shown, so the saved review reads the same way every time.
    onSubmit({ rating, tags: REVIEW_TAGS.filter((t) => tags.includes(t)), comment: comment.trim() || undefined });
  };

  const ratingLabelId = `${uid}-rating`;
  const ratingErrorId = `${uid}-rating-error`;
  const commentId = `${uid}-comment`;

  return (
    <form onSubmit={submit} noValidate aria-label={`Review ${booking.serviceName}`} className="space-y-5 border-t border-line bg-canvas/60 px-4 py-5 sm:px-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Service</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">{booking.serviceName}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Partner</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">{booking.partnerName ?? "Your HomeCareX partner"}</dd>
        </div>
      </dl>

      <div ref={ratingRef}>
        <p id={ratingLabelId} className="mb-1 text-sm font-semibold text-ink">
          Your rating <span className="text-danger" aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </p>
        <StarRatingInput value={rating} onChange={(v) => { setRating(v); setRatingError(""); }} labelledBy={ratingLabelId} invalid={Boolean(ratingError)} describedBy={ratingError ? ratingErrorId : undefined} />
        {ratingError && (
          <p id={ratingErrorId} role="alert" className="mt-1 text-sm font-medium text-danger">
            {ratingError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">
          What went well? <span className="font-normal text-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={clsx(
                  "min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors",
                  on ? "border-brand bg-brand text-white" : "border-line bg-panel text-ink hover:border-brand/40 hover:bg-brand-soft/50",
                  FOCUS_RING,
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor={commentId} className="text-sm font-semibold text-ink">
            Tell us more <span className="font-normal text-muted">(optional)</span>
          </label>
          <span className="text-xs tabular-nums text-muted" aria-hidden="true">
            {comment.length}/{REVIEW_COMMENT_MAX}
          </span>
        </div>
        <textarea
          id={commentId}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={REVIEW_COMMENT_MAX}
          rows={4}
          placeholder="What was it like? Your feedback helps other customers and your partner."
          className={clsx("w-full resize-y rounded-xl border border-line bg-panel p-3 text-sm text-ink placeholder:text-muted/70", FOCUS_RING)}
        />
      </div>

      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 focus:outline-none">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={submitting} className={clsx("min-h-[44px] rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-60", FOCUS_RING)}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={clsx("inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(67,56,202,.6)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60", FOCUS_RING)}
        >
          {submitting ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </form>
  );
}
