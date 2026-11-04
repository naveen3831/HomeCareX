import { useEffect, useRef } from "react";
import { CalendarDays, Check, CreditCard, MapPin, Sparkles, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";

const STEPS: { title: string; Icon: LucideIcon }[] = [
  { title: "Service Details", Icon: Sparkles },
  { title: "Address", Icon: MapPin },
  { title: "Date & Time", Icon: CalendarDays },
  { title: "Review & Pay", Icon: CreditCard },
];

/** Progress card + step heading. Moves focus to the heading on every step change so screen-reader
 *  and keyboard users land somewhere meaningful instead of at the top of a long page. */
interface BookingStepperProps {
  currentStep: number;
  /** Focus the heading on first render too (used when the step guard redirected the customer). */
  focusOnMount?: boolean;
  /** Tighter vertical spacing (Step 4 fits on one screen). */
  compact?: boolean;
  /** When set, completed steps become buttons that jump back to that step. */
  onStepSelect?: (step: number) => void;
}

export default function BookingStepper({ currentStep, focusOnMount = false, compact = false, onStepSelect }: BookingStepperProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // On a plain page load/refresh don't steal focus; on step changes (and guard redirects) do.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!focusOnMount) return;
    }
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusOnMount only matters on the first run
  }, [currentStep]);

  const next = STEPS[currentStep]; // the step after the current one (undefined on the last)

  return (
    <div className={clsx("w-full rounded-[22px] sm:rounded-3xl border border-slate-100/90 bg-white shadow-sm", compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5")}>
      <div className="flex items-end justify-between gap-3">
        <div>
          {currentStep !== 2 && (
            <p aria-hidden="true" className="text-xs font-semibold text-[#4F46E5]">
              Step {currentStep} of {STEPS.length}
            </p>
          )}
          <h2 ref={headingRef} tabIndex={-1} className="mt-0.5 rounded text-base sm:text-lg font-bold tracking-tight text-slate-900 outline-none focus:outline-none focus:ring-0">
            <span className="sr-only">
              Step {currentStep} of {STEPS.length}:{" "}
            </span>
            {currentStep === 2 ? "Address Details" : STEPS[currentStep - 1].title}
          </h2>
        </div>
        {next && (
          <p aria-hidden="true" className="shrink-0 pb-0.5 text-xs text-slate-400">
            Next: <span className="font-medium text-slate-500">{currentStep === 2 ? "Schedule" : next.title}</span>
          </p>
        )}
      </div>

      {/* Phones: a four-segment bar matching reference mockup */}
      <div
        role="progressbar"
        aria-label="Booking progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={currentStep}
        aria-valuetext={`Step ${currentStep} of ${STEPS.length}`}
        className="mt-3.5 flex gap-2 sm:hidden"
      >
        {STEPS.map((s, i) => (
          <span
            key={s.title}
            className={clsx(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              i < currentStep ? "bg-[#4F46E5]" : "bg-slate-200"
            )}
          />
        ))}
      </div>

      {/* Tablet / desktop: icon trail */}
      <ol aria-label="Booking progress" className="mt-5 hidden items-center sm:flex">
        {STEPS.map(({ title, Icon }, i) => {
          const n = i + 1;
          const done = currentStep > n;
          const current = currentStep === n;
          const last = n === STEPS.length;
          const body = (
            <>
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 motion-reduce:transition-none",
                  done && "bg-brand text-white",
                  current && "bg-brand-soft text-brand ring-2 ring-brand shadow-[0_0_0_6px_rgba(67,56,202,.10)]",
                  !done && !current && "border border-line bg-canvas text-muted",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-[11px] text-muted">Step {n}</span>
                <span className={clsx("block truncate text-sm font-semibold", current || done ? "text-ink" : "text-muted")}>
                  <span className="sr-only">{done ? "Completed: " : current ? "Current: " : "Upcoming: "}</span>
                  {title}
                </span>
              </span>
            </>
          );

          return (
            <li key={title} className={clsx("flex items-center", !last && "flex-1")}>
              {done && onStepSelect ? (
                <button
                  type="button"
                  onClick={() => onStepSelect(n)}
                  aria-label={`Jump back to step ${n}: ${title}`}
                  className={clsx("group flex items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-brand-soft", FOCUS_RING)}
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-3 p-1">{body}</div>
              )}
              {!last && <span aria-hidden="true" className={clsx("mx-3 h-0.5 flex-1 transition-colors duration-300", done ? "bg-brand" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
