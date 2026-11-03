import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronUp,
  Clock3,
  Moon,
  Sun,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { getBookableDates, todayISO, useBookingDraftStore } from "@/features/booking";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import { EmptyState, ErrorState, LoadingState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { SlotAvailability, SlotsResponse } from "@/types/booking";
import BookingSummary, { prettyDate } from "./components/BookingSummary";
import DatePicker from "./components/DatePicker";
import SlotPicker, { formatSlotLabel } from "./components/SlotPicker";

const PERIODS: { id: string; label: string; hint: string; Icon: LucideIcon; match: (hour: number) => boolean }[] = [
  { id: "morning", label: "Morning", hint: "Before 12 PM", Icon: Sunrise, match: (h) => h < 12 },
  { id: "afternoon", label: "Afternoon", hint: "12 PM – 4 PM", Icon: Sun, match: (h) => h >= 12 && h < 16 },
  { id: "evening", label: "Evening", hint: "After 4 PM", Icon: Moon, match: (h) => h >= 16 },
];

const startHour = (slot: string): number => {
  const h = parseInt(slot.split("-")[0] ?? "", 10);
  return Number.isNaN(h) ? 0 : h;
};

export default function StepSlot() {
  const serviceId = useBookingDraftStore((s) => s.serviceId);
  const date = useBookingDraftStore((s) => s.date);
  const slot = useBookingDraftStore((s) => s.slot);
  const setDate = useBookingDraftStore((s) => s.setDate);
  const setSlot = useBookingDraftStore((s) => s.setSlot);
  const setStep = useBookingDraftStore((s) => s.setStep);
  const online = useOnlineStatus();

  const [timeExpanded, setTimeExpanded] = useState(true);

  const bookableDates = useMemo(() => getBookableDates(), []);

  // Default to today; a persisted draft whose date has since passed is reset (with its slot).
  useEffect(() => {
    const today = todayISO();
    if (!date) {
      setDate(today);
    } else if (date < today) {
      setDate(today);
      setSlot(null);
    }
  }, [date, setDate, setSlot]);

  const {
    data: slotResponse,
    isError,
    error,
    refetch,
  } = useQuery<SlotsResponse, NormalizedApiError>({
    queryKey: ["slots", serviceId, date],
    queryFn: () => bookingApi.getSlots(serviceId as string, date as string),
    enabled: Boolean(serviceId && date),
  });

  // Safely extract the slot array from the API response object
  const slots: SlotAvailability[] | undefined = Array.isArray(slotResponse)
    ? slotResponse
    : slotResponse?.slots;

  // The chosen slot may have filled up since it was picked (or since a refetch): drop it.
  useEffect(() => {
    if (!slots || !slot) return;
    const current = slots.find((s) => s.slot === slot);
    if (!current || !current.available) setSlot(null);
  }, [slots, slot, setSlot]);

  const handleDateChange = (next: string) => {
    if (next === date) return;
    setDate(next);
    setSlot(null); // a slot only makes sense for the date it was picked on
  };

  const canContinue = Boolean(date && slot);

  let content: ReactNode;
  if (isError) {
    content = (
      <ErrorState
        title="Couldn't load availability"
        message={error?.message ?? "Something went wrong. Please try again."}
        onRetry={() => void refetch()}
      />
    );
  } else if (!slots && !online) {
    content = (
      <ErrorState
        title="You're offline"
        message="Reconnect to see the time slots available for this date."
        onRetry={() => void refetch()}
      />
    );
  } else if (!slots) {
    content = <LoadingState label="Loading available slots…" />;
  } else if (slots.length === 0) {
    content = (
      <EmptyState
        title="No time slots for this date"
        description="Please choose another date."
      />
    );
  } else {
    content = <SlotPicker slots={slots} value={slot} onChange={setSlot} />;
  }

  const dateLabel = date ? prettyDate(date) : null;

  const selectedDateObj = useMemo(() => (date ? new Date(date) : new Date()), [date]);
  const monthYearLabel = useMemo(
    () => selectedDateObj.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    [selectedDateObj],
  );

  const backBtn = (
    <button
      type="button"
      onClick={() => setStep(2)}
      className={clsx(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas",
        FOCUS_RING,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </button>
  );

  const nextBtn = (
    <button
      type="button"
      onClick={() => setStep(4)}
      disabled={!canContinue}
      className={clsx(
        "group inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-95",
        FOCUS_RING,
      )}
    >
      Continue to review
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      {/* =========================================================================
          MOBILE VIEW (matches reference mockup exactly)
         ========================================================================= */}
      <div className="min-w-0 space-y-3.5 pb-[72px] lg:pb-0 lg:hidden">
        {/* Intro header */}
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-xs">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              When should we arrive?
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick a date and time that works for you.
            </p>
          </div>
        </div>

        {/* 1. Choose a date card */}
        <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm">
          <div className="mb-3.5 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">1. Choose a date</h4>
            <div className="text-xs font-semibold text-slate-700">
              <span>{monthYearLabel}</span>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="Choose a date"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {bookableDates.map((d) => {
              const selected = d.iso === date;
              return (
                <button
                  key={d.iso}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleDateChange(d.iso)}
                  className={clsx(
                    "flex min-w-[54px] flex-1 flex-col items-center justify-center rounded-2xl py-2.5 px-2 text-center transition-all",
                    FOCUS_RING,
                    selected
                      ? "bg-[#4F46E5] text-white shadow-xs"
                      : "border border-slate-200/90 bg-white text-slate-700 hover:border-[#C7D2FE]",
                  )}
                >
                  <span className={clsx("text-xs font-semibold", selected ? "text-white/80" : "text-slate-400")}>
                    {d.weekday}
                  </span>
                  <span className={clsx("mt-1 text-base font-bold tabular-nums", selected ? "text-white" : "text-slate-900")}>
                    {d.day}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Choose a time card */}
        {!timeExpanded ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setTimeExpanded(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setTimeExpanded(true);
            }}
            className={clsx(
              "flex items-center justify-between rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm cursor-pointer transition-all hover:bg-slate-50",
              FOCUS_RING,
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                <Clock3 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">2. Choose a time</h4>
                <p className="text-xs text-slate-500">
                  {slot ? formatSlotLabel(slot) : "Select an available time slot"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
          </div>
        ) : (
          <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setTimeExpanded((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setTimeExpanded((prev) => !prev);
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">2. Choose a time</h4>
                  <p className="text-xs text-slate-500">Each slot is a 2-hour window</p>
                </div>
              </div>
              <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
            </div>

            {isError ? (
              <div className="py-2 text-center text-xs text-rose-500">
                Couldn't load slots. Please retry.
              </div>
            ) : !slots ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Loading slots…
              </div>
            ) : slots.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No time slots available for this date.
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {PERIODS.map(({ id, label, hint, Icon, match }) => {
                  const group = slots.filter((s) => match(startHour(s.slot)));
                  if (group.length === 0) return null;
                  return (
                    <div key={id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                          <span className="text-xs font-bold text-slate-900">{label}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{hint}</span>
                      </div>
                      <div className="space-y-2">
                        {group.map((slotItem) => {
                          const isSelected = slot === slotItem.slot;
                          const isAvailable = Boolean(slotItem.available);
                          return (
                            <button
                              key={slotItem.slot}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => setSlot(slotItem.slot)}
                              className={clsx(
                                "flex w-full items-center justify-between rounded-xl p-3 text-left transition-all",
                                FOCUS_RING,
                                isSelected
                                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/40 shadow-xs"
                                  : isAvailable
                                  ? "border border-slate-200 bg-white hover:border-[#C7D2FE] shadow-2xs"
                                  : "border border-slate-200/70 bg-[#F8FAFC] cursor-not-allowed",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={clsx(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                    isSelected
                                      ? "border-[#4F46E5] border-2"
                                      : isAvailable
                                      ? "border-slate-400"
                                      : "border-slate-300 bg-slate-100",
                                  )}
                                >
                                  {isSelected && <span className="h-2 w-2 rounded-full bg-[#4F46E5]" />}
                                </span>
                                <span
                                  className={clsx(
                                    "text-xs sm:text-sm font-semibold tracking-wide",
                                    isSelected
                                      ? "text-slate-900 font-bold"
                                      : isAvailable
                                      ? "text-slate-800"
                                      : "text-slate-600",
                                  )}
                                >
                                  {formatSlotLabel(slotItem.slot)}
                                </span>
                              </div>

                              {!isAvailable ? (
                                <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                  Full
                                </span>
                              ) : isSelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#15803D]">
                                  <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />{" "}
                                  {slotItem.remaining !== undefined ? `${slotItem.remaining} left` : "Available"}
                                </span>
                              ) : slotItem.remaining !== undefined ? (
                                <span className="text-xs font-semibold text-[#4F46E5]">{slotItem.remaining} left</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mobile: sticky action bar (Selected Slot preview, Back & Continue to Review) */}
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Selected Slot:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>{dateLabel ?? "Select a date"}</span>
                </span>
                <span className="text-slate-300 font-light">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>{slot ? formatSlotLabel(slot) : "-- : --"}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={clsx(
                  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 active:scale-95",
                  FOCUS_RING,
                )}
              >
                <ArrowLeft className="h-4 w-4 text-slate-700" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={!canContinue}
                className={clsx(
                  "group inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#4F46E5] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-50 active:scale-95",
                  FOCUS_RING,
                )}
              >
                Continue to Review
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DESKTOP VIEW (100% untouched)
         ========================================================================= */}
      <div className="hidden lg:block min-w-0 space-y-6">
        {/* Intro */}
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_12px_24px_-12px_rgba(67,56,202,.8)]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">When should we arrive?</h3>
            <p className="mt-0.5 text-sm text-muted">Pick a day in the next two weeks, then choose a time that suits you.</p>
          </div>
        </div>

        {/* Date */}
        <section aria-labelledby="slot-date-heading" className="rounded-3xl border border-line bg-panel p-5 shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h4 id="slot-date-heading" className="text-base font-semibold text-ink">
              1. Choose a date
            </h4>
            {dateLabel && <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{dateLabel}</span>}
          </div>
          <DatePicker value={date} onChange={handleDateChange} />
        </section>

        {/* Time */}
        <section aria-labelledby="slot-time-heading" className="rounded-3xl border border-line bg-panel p-5 shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h4 id="slot-time-heading" className="text-base font-semibold text-ink">
              2. Choose a time
            </h4>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Each slot is a 2-hour window
            </span>
          </div>
          <div aria-live="polite">{content}</div>
        </section>
      </div>

      {/* Desktop: sticky booking summary */}
      <BookingSummary ariaLabel="Your visit" actions={<>{backBtn}{nextBtn}</>} footnote="You can review everything before paying" />
    </div>
  );
}
