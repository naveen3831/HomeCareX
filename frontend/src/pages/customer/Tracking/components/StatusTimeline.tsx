import clsx from "clsx";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Home,
  Truck,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TimelineItem } from "../../BookingDetails/bookingDetailModel";
import { formatStepTime } from "../trackingModel";

const STATE_TEXT: Record<TimelineItem["state"], string> = {
  done: "Done",
  current: "Current step",
  upcoming: "Upcoming",
  failed: "Stopped",
};

const ICONS: Record<string, LucideIcon> = {
  confirmed: ClipboardCheck,
  assigned: UserCheck,
  en_route: Truck,
  arrived: Home,
  in_progress: Wrench,
  completed: CheckCircle2,
};

const DESCRIPTIONS: Record<string, string> = {
  confirmed: "Your booking has been confirmed",
  assigned: "Partner has been assigned",
  en_route: "Partner is en route",
  arrived: "Partner has arrived at your location",
  in_progress: "Service is in progress",
  completed: "Service has been completed",
};

/** The six tracking steps as a well-spaced vertical timeline. The current step is marked and announced to screen readers. */
export default function StatusTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol
      aria-label="Booking progress"
      className="tk-timeline-list m-0 flex h-full list-none flex-col justify-between p-0"
    >
      {items.map((item, i) => {
        const next = items[i + 1];
        const lastItem = !next;
        const when = formatStepTime(item.at);
        const Icon = ICONS[item.key] ?? CheckCircle2;
        const lineColor =
          item.state === "done"
            ? next?.state === "done"
              ? "bg-emerald-500"
              : "bg-brand"
            : "bg-slate-200";

        return (
          <li
            key={item.key}
            aria-current={item.state === "current" ? "step" : undefined}
            className={clsx(
              "tk-timeline-item relative flex items-start gap-3",
              !lastItem && "pb-2.5 lg:pb-3",
            )}
          >
            {!lastItem && (
              <span
                aria-hidden="true"
                className={clsx(
                  "absolute bottom-0 left-[11px] top-6 w-0.5",
                  lineColor,
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={clsx(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                item.state === "done" && "bg-emerald-500 text-white",
                item.state === "current" &&
                  "bg-brand text-white ring-4 ring-brand/15",
                item.state !== "done" &&
                  item.state !== "current" &&
                  "border border-slate-200 bg-slate-100 text-slate-400",
              )}
            >
              {item.state === "done" ? (
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 leading-tight">
                <p
                  className={clsx(
                    "truncate text-xs leading-tight",
                    item.state === "upcoming"
                      ? "font-semibold text-slate-500"
                      : "font-semibold text-ink",
                    item.state === "current" && "text-ink",
                  )}
                >
                  {item.label}
                  <span className="sr-only"> — {STATE_TEXT[item.state]}</span>
                </p>
                <span
                  className={clsx(
                    "shrink-0 text-[11px] leading-tight",
                    item.state === "current"
                      ? "font-medium text-brand"
                      : "text-muted",
                  )}
                >
                  {when ||
                    (item.state === "done" ? "Time not recorded" : "--:--")}
                </span>
                {item.state === "current" && (
                  <span className="ml-auto shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-semibold leading-none text-brand">
                    Current
                  </span>
                )}
              </div>
              <p
                className={clsx(
                  "mt-0.5 truncate text-[11px] leading-tight",
                  item.state === "current"
                    ? "font-medium text-brand"
                    : "text-muted",
                )}
              >
                {DESCRIPTIONS[item.key]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
