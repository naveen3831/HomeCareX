import { useId, useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ErrorState, LoadingState, OfflineState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useRescheduleBooking } from "@/hooks/useBooking";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import type { SlotAvailability, SlotsResponse } from "@/types/booking";
import DatePicker from "../../Book/components/DatePicker";
import SlotPicker from "../../Book/components/SlotPicker";
import { formatWhen } from "../../Bookings/bookingModel";
import DialogShell from "./DialogShell";

interface Props {
  bookingId: string;
  serviceId: string;
  /** The booking's current date and slot. */
  date: string;
  slot: string;
  onClose: () => void;
}

type Step = "date" | "slot" | "review" | "done";

const STEP_LABEL: Record<Exclude<Step, "done">, string> = {
  date: "Date",
  slot: "Time",
  review: "Review",
};
const STEP_ORDER = ["date", "slot", "review"] as const;

const BUTTON =
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

/** Pick a new date, pick a slot, review, confirm. The server re-checks the slot under a lock on confirm. */
export default function RescheduleDialog({
  bookingId,
  serviceId,
  date: currentDate,
  slot: currentSlot,
  onClose,
}: Props) {
  const titleId = useId();
  const online = useOnlineStatus();
  const reschedule = useRescheduleBooking(bookingId);
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const slotsQuery = useQuery<SlotsResponse, NormalizedApiError>({
    queryKey: ["slots", serviceId, date],
    queryFn: () => bookingApi.getSlots(serviceId, date as string),
    enabled: Boolean(date) && step === "slot",
  });

  // The slot the booking already has is not a "new" slot: leave it out of the list.
  const slots: SlotAvailability[] | undefined = useMemo(
    () =>
      slotsQuery.data?.slots.filter(
        (s) => !(date === currentDate && s.slot === currentSlot),
      ),
    [slotsQuery.data, date, currentDate, currentSlot],
  );

  const busy = reschedule.isPending;

  function confirm() {
    if (!date || !slot || busy) return;
    reschedule.mutate(
      { date, slot },
      {
        onSuccess: () => setStep("done"),
        // The slot filled up while the customer was deciding: send them back to pick another.
        onError: (err) => {
          if (err.status === 409) {
            setSlot(null);
            setStep("slot");
          }
        },
      },
    );
  }

  if (step === "done" && date && slot) {
    return (
      <DialogShell titleId={titleId} title="Booking rescheduled" onClose={onClose}>
        <div role="status" className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-sm text-ink">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <span>Your booking is now on {formatWhen(date, slot)}.</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className={clsx(BUTTON, "bg-brand text-white hover:opacity-90", FOCUS_RING)}
          >
            Done
          </button>
        </div>
      </DialogShell>
    );
  }

  let content;
  if (step === "date") {
    content = (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Rescheduling doesn't change your price. You can move a booking until a partner is assigned; after
          that, please cancel and book again.
        </p>
        <DatePicker
          value={date}
          onChange={(d) => {
            setDate(d);
            setSlot(null);
          }}
        />
      </div>
    );
  } else if (step === "slot") {
    let slotsView;
    if (slotsQuery.isError) {
      slotsView = !online || slotsQuery.error.status === 0 ? (
        <OfflineState onRetry={() => void slotsQuery.refetch()} />
      ) : (
        <ErrorState
          title="Couldn't load availability"
          message={slotsQuery.error.message}
          onRetry={() => void slotsQuery.refetch()}
        />
      );
    } else if (!slots) {
      slotsView = <LoadingState label="Loading available slots…" />;
    } else {
      slotsView = <SlotPicker slots={slots} value={slot} onChange={setSlot} />;
    }
    content = (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Choose a new time on {date ? formatWhen(date, "", true) : "the day you picked"}.
        </p>
        {reschedule.isError && reschedule.error.status === 409 && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {reschedule.error.message} Please pick another slot.
          </p>
        )}
        {slotsView}
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted">Current</dt>
            <dd className="text-right font-medium text-ink">{formatWhen(currentDate, currentSlot)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="font-semibold text-ink">New</dt>
            <dd className="text-right font-bold text-brand">
              {date && slot ? formatWhen(date, slot) : ""}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          We check the slot is still free when you confirm. If it was just taken, we'll ask you to pick another.
        </p>
        {reschedule.isError && reschedule.error.status !== 409 && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {reschedule.error.message}
          </p>
        )}
        {!online && (
          <p role="status" className="text-sm text-muted">
            You're offline. Reconnect to confirm.
          </p>
        )}
      </div>
    );
  }

  const index = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);
  const canNext = step === "date" ? Boolean(date) : step === "slot" ? Boolean(slot) : false;

  return (
    <DialogShell titleId={titleId} title="Reschedule booking" onClose={onClose} busy={busy}>
      <ol className="mb-4 flex items-center gap-2 text-xs font-semibold" aria-label="Steps">
        {STEP_ORDER.map((s, i) => (
          <li
            key={s}
            aria-current={i === index ? "step" : undefined}
            className={clsx(
              "rounded-full px-3 py-1",
              i === index ? "bg-brand text-white" : i < index ? "bg-brand-soft text-brand" : "bg-canvas text-muted",
            )}
          >
            {i + 1}. {STEP_LABEL[s]}
          </li>
        ))}
      </ol>

      {content}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        {step === "date" ? (
          <button
            type="button"
            onClick={onClose}
            className={clsx(BUTTON, "border border-line bg-panel text-ink", FOCUS_RING)}
          >
            Keep current time
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step === "review" ? "slot" : "date")}
            disabled={busy}
            className={clsx(BUTTON, "border border-line bg-panel text-ink", FOCUS_RING)}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
        )}
        {step === "review" ? (
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !online}
            className={clsx(BUTTON, "bg-brand text-white hover:opacity-90", FOCUS_RING)}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Confirm new time
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step === "date" ? "slot" : "review")}
            disabled={!canNext}
            className={clsx(BUTTON, "bg-brand text-white hover:opacity-90", FOCUS_RING)}
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </DialogShell>
  );
}
