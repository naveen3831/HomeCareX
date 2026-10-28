import { useRef, type KeyboardEvent, type ReactNode } from "react";
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
        className="grid min-w-0 flex-1 grid-cols-4 rounded-xl bg-[#f1f3f7] p-1 md:rounded-none md:bg-transparent md:p-0"
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
                "flex min-h-[40px] w-full min-w-0 items-center justify-center whitespace-nowrap text-center text-xs transition-all sm:text-sm md:min-h-[44px]",
                // Mobile segmented control styling (matching Image 2)
                selected
                  ? "rounded-lg bg-[#eeebf9] text-[#4338ca] font-semibold border-b-2 border-[#4338ca]"
                  : "rounded-lg border-b-2 border-transparent text-slate-600 font-medium hover:text-slate-900",
                // Desktop override (matching original desktop tablist)
                "-mb-px md:rounded-none md:bg-transparent md:border-b-2",
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
