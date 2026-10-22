import { useId, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { FOCUS_RING } from "@/components/customer/focusRing";
import { OfflineState } from "@/components/customer";
import { Skeleton } from "@/components/customer/Skeleton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCancelBooking, useCancelPreview } from "@/hooks/useBooking";

import type {
  CancellationSummary,
  CancelBookingResult,
} from "@/types/bookingDetail";

import { rupees } from "../../Bookings/bookingModel";
import DialogShell from "./DialogShell";

interface Props {
  bookingId: string;
  onClose: () => void;
}

const REASONS = [
  "My plans changed",
  "I booked by mistake",
  "I found a better price",
  "The partner is taking too long",
] as const;

const OTHER = "Other";

const BUTTON =
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const hoursText = (hours: number): string =>
  `${hours} ${hours === 1 ? "hour" : "hours"}`;

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function formatAmount(value: unknown): string {
  return isValidAmount(value) ? rupees(value) : "Amount unavailable";
}

/** Describes the configured cancellation policy separately from the actual fee. */
function policyText(q: CancellationSummary): string {
  if (
    typeof q.windowHours !== "number" ||
    !Number.isFinite(q.windowHours) ||
    typeof q.feeAmount !== "number" ||
    !Number.isFinite(q.feeAmount)
  ) {
    return "Cancellation policy information is currently unavailable.";
  }

  const window = hoursText(q.windowHours);
  const fee = rupees(q.feeAmount);

  return q.feeAmount === 0
    ? `Cancel for free up to ${window} before your slot.`
    : `Cancel for free up to ${window} before your slot. Inside ${window}, a ${fee} cancellation fee applies.`;
}

/** Explains payment and refund status without assuming a missing amount is zero. */
function refundText(q: CancellationSummary): string {
  if (!isValidAmount(q.paidAmount)) {
    return "Payment information is unavailable. Refresh the preview to verify the amount.";
  }

  if (q.paidAmount === 0) {
    return "No completed payment was found for this booking. No refund is currently due.";
  }

  if (!isValidAmount(q.refundAmount)) {
    return "The refund amount could not be verified. Refresh the preview before cancelling.";
  }

  if (q.refundAmount === 0) {
    return "No refund is due based on the current cancellation calculation.";
  }

  return `${rupees(q.refundAmount)} is the estimated refund to your original payment method, subject to payment-provider processing.`;
}

export default function CancelDialog({ bookingId, onClose }: Props) {
  const titleId = useId();
  const online = useOnlineStatus();

  const preview = useCancelPreview(bookingId, true);
  const cancel = useCancelBooking(bookingId);

  const [choice, setChoice] = useState<string>(REASONS[0]);
  const [other, setOther] = useState("");
  const [result, setResult] = useState<CancelBookingResult | null>(null);

  const reason = (choice === OTHER ? other : choice).trim();
  const reasonOk = reason.length >= 3;
  const busy = cancel.isPending;

  function confirm() {
    if (
      !reasonOk ||
      busy ||
      !online ||
      preview.isFetching ||
      preview.isError ||
      !preview.data
    ) {
      return;
    }

    const q = preview.data;

    // Do not cancel based on an incomplete or inconsistent preview.
    if (
      !isValidAmount(q.paidAmount) ||
      !isValidAmount(q.fee) ||
      !isValidAmount(q.refundAmount) ||
      typeof q.windowHours !== "number" ||
      !Number.isFinite(q.windowHours) ||
      q.windowHours < 0 ||
      !isValidAmount(q.feeAmount)
    ) {
      return;
    }

    cancel.mutate(reason, {
      onSuccess: (response) => setResult(response),
    });
  }

  if (result) {
    const cancellation = result.cancellation;

    return (
      <DialogShell
        titleId={titleId}
        title="Booking cancelled"
        onClose={onClose}
      >
        <div role="status" className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-sm text-ink">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
              aria-hidden="true"
            />
            <span>
              Your booking has been cancelled.{" "}
              {isValidAmount(cancellation.fee) && cancellation.fee > 0
                ? `A ${rupees(cancellation.fee)} cancellation fee was applied. `
                : "No cancellation fee was reported. "}
              {cancellation.refundStatus === "requested" &&
              isValidAmount(cancellation.refundAmount)
                ? `Your ${rupees(cancellation.refundAmount)} refund request has been filed.`
                : ""}
            </span>
          </p>

          <button
            type="button"
            onClick={onClose}
            className={clsx(
              BUTTON,
              "bg-brand text-white hover:opacity-90",
              FOCUS_RING,
            )}
          >
            Done
          </button>
        </div>
      </DialogShell>
    );
  }

  let body;

  if (preview.isPending) {
    body = (
      <div
        className="space-y-3"
        aria-busy="true"
        aria-label="Checking the cancellation fee"
      >
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  } else if (preview.isError) {
    const error = preview.error;

    body =
      !online || error.status === 0 ? (
        <div className="space-y-3">
          <OfflineState onRetry={() => void preview.refetch()} />
          <button
            type="button"
            onClick={() => void preview.refetch()}
            disabled={preview.isFetching}
            className={clsx(
              BUTTON,
              "border border-line bg-panel text-ink",
              FOCUS_RING,
            )}
          >
            <RefreshCw
              className={clsx("h-4 w-4", preview.isFetching && "animate-spin")}
            />
            Retry preview
          </button>
        </div>
      ) : (
        <div role="alert" className="space-y-3">
          <p className="text-sm font-semibold text-ink">
            {error.status === 409
              ? "This booking can't be cancelled now"
              : "We couldn't load the cancellation preview"}
          </p>
          <p className="text-sm text-muted">{error.message}</p>

          <div className="flex gap-2">
            {error.status !== 409 && (
              <button
                type="button"
                onClick={() => void preview.refetch()}
                disabled={preview.isFetching}
                className={clsx(
                  BUTTON,
                  "bg-brand text-white hover:opacity-90",
                  FOCUS_RING,
                )}
              >
                {preview.isFetching && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                BUTTON,
                "border border-line bg-panel text-ink",
                FOCUS_RING,
              )}
            >
              Close
            </button>
          </div>
        </div>
      );
  } else {
    const q = preview.data;

    const validMoney =
      isValidAmount(q.paidAmount) &&
      isValidAmount(q.fee) &&
      isValidAmount(q.refundAmount) &&
      isValidAmount(q.feeAmount);

    const validWindow =
      typeof q.windowHours === "number" &&
      Number.isFinite(q.windowHours) &&
      q.windowHours >= 0;

    const previewValid = validMoney && validWindow;

    body = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        {!previewValid && (
          <div
            role="alert"
            className="space-y-2 rounded-xl bg-danger-soft px-3 py-3 text-sm text-danger"
          >
            <p className="font-semibold">
              We couldn't verify all cancellation amounts.
            </p>
            <p>
              Refresh the preview. Cancellation stays unavailable until the
              policy fee, payment amount, and refund calculation are valid.
            </p>
            <button
              type="button"
              onClick={() => void preview.refetch()}
              disabled={preview.isFetching}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-current px-3 font-semibold"
            >
              <RefreshCw
                className={clsx(
                  "h-4 w-4",
                  preview.isFetching && "animate-spin",
                )}
              />
              Refresh preview
            </button>
          </div>
        )}

        <p className="text-sm text-muted">{policyText(q)}</p>

        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted">Paid amount</dt>
            <dd className="font-semibold text-ink">
              {formatAmount(q.paidAmount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted">Cancellation fee</dt>
            <dd
              className={clsx(
                "font-semibold",
                isValidAmount(q.fee) && q.fee > 0
                  ? "text-danger"
                  : "text-green-700",
              )}
            >
              {!isValidAmount(q.fee)
                ? "Unavailable"
                : q.fee > 0
                  ? `− ${rupees(q.fee)}`
                  : "Free"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="font-semibold text-ink">Estimated refund</dt>
            <dd className="font-bold text-ink">
              {formatAmount(q.refundAmount)}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted">{refundText(q)}</p>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-ink">
            Why are you cancelling?
          </legend>

          <div className="flex flex-col gap-1.5">
            {[...REASONS, OTHER].map((reasonOption) => (
              <label
                key={reasonOption}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-3 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={reasonOption}
                  checked={choice === reasonOption}
                  onChange={() => setChoice(reasonOption)}
                  className={clsx("h-4 w-4 accent-brand", FOCUS_RING)}
                />
                {reasonOption}
              </label>
            ))}
          </div>

          {choice === OTHER && (
            <>
              <label htmlFor={`${titleId}-other`} className="sr-only">
                Tell us why
              </label>
              <textarea
                id={`${titleId}-other`}
                value={other}
                onChange={(event) => setOther(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Tell us a little more"
                className={clsx(
                  "mt-2 w-full rounded-xl border border-line bg-panel p-3 text-sm text-ink",
                  FOCUS_RING,
                )}
              />
            </>
          )}
        </fieldset>

        {cancel.isError && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {cancel.error.message}
          </p>
        )}

        {!online && (
          <p role="status" className="text-sm text-muted">
            You're offline. Reconnect to cancel.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={clsx(
              BUTTON,
              "border border-line bg-panel text-ink",
              FOCUS_RING,
            )}
          >
            Keep booking
          </button>

          <button
            type="submit"
            disabled={
              !reasonOk ||
              busy ||
              !online ||
              preview.isFetching ||
              !previewValid
            }
            className={clsx(
              BUTTON,
              "bg-danger text-white hover:opacity-90",
              FOCUS_RING,
            )}
          >
            {busy && (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {isValidAmount(q.fee) && q.fee > 0
              ? `Cancel and pay ${rupees(q.fee)} fee`
              : "Cancel booking"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <DialogShell
      titleId={titleId}
      title="Cancel this booking?"
      onClose={onClose}
      busy={busy}
    >
      {body}
    </DialogShell>
  );
}
