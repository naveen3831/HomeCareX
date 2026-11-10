import { Search, X } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "../focusRing";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Modern pill-shaped search input matching the user's mockup.
 * Clean white background with subtle border, thin dark search icon and placeholder.
 */
export function CategorySearch({ value, onChange, className }: Props) {
  return (
    <div
      role="search"
      className={clsx(
        "relative flex h-12 w-full items-center gap-3 rounded-full border border-slate-200/80 bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-200",
        "focus-within:border-brand/70 focus-within:ring-2 focus-within:ring-brand/10",
        className,
      )}
    >
      <label htmlFor="categories-search" className="sr-only">
        Search categories
      </label>
      <Search className="h-4 w-4 text-slate-800 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      <input
        id="categories-search"
        type="search"
        value={value}
        maxLength={60}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search categories, e.g. cleaning"
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal font-normal [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={clsx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700",
            FOCUS_RING,
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
