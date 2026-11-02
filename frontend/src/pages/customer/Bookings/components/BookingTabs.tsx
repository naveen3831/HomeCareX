import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { BookingTab } from "@/types/bookingList";
import { TABS } from "../bookingTabs";

interface Props {
  active: BookingTab;
  onChange: (tab: BookingTab) => void;
  /** id of the element these tabs control, so screen readers can link tab and panel. */
  panelId: string;
  /** Sits at the right end of the tab row (the filter button). */
  trailing?: ReactNode;
}

export const tabId = (tab: BookingTab): string => `booking-tab-${tab}`;

/**
 * Equal-width booking tabs, with an optional action at the right.
 * ARIA tabs pattern: one tab stop, arrows/Home/End move between tabs.
 */
export function BookingTabs({ active, onChange, panelId, trailing }: Props) {
  const refs = useRef<Partial<Record<BookingTab, HTMLButtonElement | null>>>(
    {},
  );

  useEffect(() => {
    refs.current[active]?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [active]);

  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;

    e.preventDefault();
    const target = TABS[next].id;
    onChange(target);
    refs.current[target]?.focus();
  };

  return (
    <div className="flex items-center gap-2 border-b-0 md:border-b md:border-line">
      <div
        role="tablist"
        aria-label="Booking status"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-5 md:gap-0 md:overflow-visible md:pb-0 md:rounded-none md:bg-transparent md:p-0"
      >
        {TABS.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => move(e, i)}
              className={clsx(
                // Mobile: clean, neat pill chips (matching Payments page filter tabs)
                "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all select-none active:scale-95",
                selected
                  ? "bg-[#4338ca] text-white shadow-xs"
                  : "border border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                // Desktop override (matching original desktop tablist - web view untouched)
                "md:min-h-[44px] md:w-full md:rounded-none md:border-0 md:border-b-2 md:bg-transparent md:px-0 md:py-0 md:text-sm md:shadow-none md:active:scale-100",
                "-mb-px",
                selected
                  ? "md:border-brand md:text-brand"
                  : "md:border-transparent md:text-muted md:hover:text-ink",
                FOCUS_RING,
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 pb-1">{trailing}</div>}
    </div>
  );
}
