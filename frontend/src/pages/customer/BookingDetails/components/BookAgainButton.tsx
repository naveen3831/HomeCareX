import clsx from "clsx";
import { Loader2, RotateCw } from "lucide-react";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useBookAgain } from "@/features/booking/bookAgain";
import type { BookingDetailView } from "@/types/bookingDetail";

interface Props {
  booking: BookingDetailView;
  className?: string;
}

/** Starts a new booking from this one: same service, quantity, add-ons and address, then Step 2 of the wizard. */
export default function BookAgainButton({ booking, className }: Props) {
  const { start, isLoading, error } = useBookAgain(booking);
  return (
    <>
      <button
        type="button"
        onClick={() => void start()}
        disabled={isLoading}
        aria-busy={isLoading}
        className={clsx(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-brand/30 bg-panel px-4 text-sm font-semibold text-brand transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70",
          FOCUS_RING,
          className,
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? "Starting…" : "Book Again"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}