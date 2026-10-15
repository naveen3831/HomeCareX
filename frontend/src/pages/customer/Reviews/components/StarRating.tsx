import { useRef, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { RATING_LABELS } from "../reviewModel";

interface InputProps {
  value: number;
  onChange: (value: number) => void;
  /** id of the visible label, so the group is announced with a name. */
  labelledBy: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * 1 to 5 star picker. A radio group: one tab stop, arrow keys / Home / End change the value.
 * Buttons are 44px so they are easy to hit on a phone.
 */
export function StarRatingInput({ value, onChange, labelledBy, invalid, describedBy }: InputProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (e: KeyboardEvent<HTMLButtonElement>, star: number) => {
    let next = star;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, star + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, star - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div role="radiogroup" aria-labelledby={labelledBy} aria-required="true" aria-invalid={invalid || undefined} aria-describedby={describedBy} className="-ml-1.5 flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const checked = value === star;
          // With nothing chosen yet, the first star is the single tab stop.
          const tabStop = checked || (value === 0 && star === 1);
          return (
            <button
              key={star}
              ref={(el) => {
                refs.current[star - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${star} ${star === 1 ? "star" : "stars"}, ${RATING_LABELS[star]}`}
              tabIndex={tabStop ? 0 : -1}
              onClick={() => onChange(star)}
              onKeyDown={(e) => move(e, star)}
              className={clsx("flex h-11 w-9 items-center justify-center rounded-lg transition-transform active:scale-90 sm:w-11", FOCUS_RING)}
            >
              <Star aria-hidden="true" className={clsx("h-7 w-7 transition-colors", star <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-[#8A87A0]")} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      <span aria-live="polite" className={clsx("text-sm font-semibold", value ? "text-ink" : "text-muted")}>
        {value ? RATING_LABELS[value] : "Tap a star"}
      </span>
    </div>
  );
}

/** Read-only stars with a text alternative ("4 out of 5 stars"). */
export function StarRatingDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden="true" width={size} height={size} className={star <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-line"} strokeWidth={1.75} />
      ))}
    </span>
  );
}
