import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight, MapPin, Check } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";
import BookingThumb from "./BookingThumb";
import { formatScheduled, type DashboardBookingDto, type BookingStatusDto } from "@/features/customer";

interface StepperConfig {
  label: string;
  steps: string[];
  activeStep: number;
  activeBg: string;
  lineBg: string;
  pillBg: string;
  pillDot: string;
}

function getStepperConfig(status: BookingStatusDto): StepperConfig {
  switch (status) {
    case "arrived":
      return {
        label: "Arrived",
        steps: ["Assigned", "En Route", "Arrived", "In Progress"],
        activeStep: 2,
        activeBg: "bg-[#10B981]",
        lineBg: "bg-[#10B981]",
        pillBg: "bg-[#ECFDF5] text-[#059669]",
        pillDot: "bg-[#10B981]",
      };
    case "en_route":
      return {
        label: "En Route",
        steps: ["Assigned", "En Route", "On Site", "Completed"],
        activeStep: 2,
        activeBg: "bg-[#F97316]",
        lineBg: "bg-[#F97316]",
        pillBg: "bg-[#FFF7ED] text-[#EA580C]",
        pillDot: "bg-[#F97316]",
      };
    case "in_progress":
      return {
        label: "In Progress",
        steps: ["Assigned", "En Route", "In Progress", "Completed"],
        activeStep: 2,
        activeBg: "bg-[#4F46E5]",
        lineBg: "bg-[#4F46E5]",
        pillBg: "bg-[#EEF2FF] text-[#4F46E5]",
        pillDot: "bg-[#4F46E5]",
      };
    case "assigned":
    default:
      return {
        label: "Assigned",
        steps: ["Assigned", "En Route", "Arrived", "Completed"],
        activeStep: 0,
        activeBg: "bg-[#2563EB]",
        lineBg: "bg-[#2563EB]",
        pillBg: "bg-[#EFF6FF] text-[#2563EB]",
        pillDot: "bg-[#2563EB]",
      };
  }
}

function getPartnerStatusText(b: DashboardBookingDto): string {
  const who = b.partnerName ?? "Partner";
  if (b.status === "en_route") return `${who} is on the way`;
  if (b.status === "arrived") return `${who} has arrived`;
  if (b.status === "in_progress") return `${who} is working on it`;
  if (b.status === "assigned") return `${who} has been assigned`;
  return formatScheduled(b.scheduledAt);
}

/**
 * Redesigned Active Bookings section:
 * - Section header with calendar icon, count badge, and "View all >"
 * - Individual cards for each in-flight booking with thumbnail, date, partner status, status pill, and 4-step progress stepper
 * - Displays top 2 active bookings on the dashboard so QuickActions remain prominently in view, with "View all" opening the full list
 */
export default function ActiveBookingCard({
  bookings,
  maxDisplay = 2,
}: {
  bookings: DashboardBookingDto[];
  maxDisplay?: number;
}) {
  const visibleBookings = bookings.slice(0, maxDisplay);

  return (
    <section aria-labelledby="active-bookings-title" className="space-y-3 sm:space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 id="active-bookings-title" className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
          <Calendar className="h-5 w-5 text-brand shrink-0" aria-hidden="true" />
          <span>Active Bookings</span>
          <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-bold text-[#4F46E5]">
            {bookings.length}
          </span>
        </h2>
        <Link
          to={customerPath("/tracking")}
          state={{ from: customerPath(), origin: customerPath() }}
          className={clsx(
            "flex items-center gap-0.5 text-sm font-semibold text-brand hover:underline",
            FOCUS_RING
          )}
        >
          <span>View all</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Booking Cards Stack (showing up to maxDisplay, defaults to 2) */}
      <div className="space-y-3 sm:space-y-3.5">
        {visibleBookings.map((b, bi) => {
          const config = getStepperConfig(b.status);
          const partnerStatus = getPartnerStatusText(b);

          return (
            <div
              key={b.id}
              className="rounded-[22px] border border-slate-100 bg-white p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(30,27,46,0.05)] transition-all duration-200 hover:border-slate-200 hover:shadow-md"
            >
              <Link
                to={`${customerPath("/tracking")}?booking=${encodeURIComponent(b.id)}`}
                state={{ from: customerPath(), origin: customerPath() }}
                className={clsx("group block focus-visible:outline-none", FOCUS_RING)}
              >
                {/* Top: Thumbnail, Details, Status Pill & Chevron */}
                <div className="flex items-start gap-3 sm:gap-3.5">
                  <BookingThumb
                    serviceName={b.serviceName}
                    index={bi}
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="break-words text-[15px] sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">
                        {b.serviceName}
                      </h3>
                      <span
                        className={clsx(
                          "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
                          config.pillBg
                        )}
                      >
                        <span className={clsx("h-1.5 w-1.5 rounded-full", config.pillDot)} />
                        {config.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{formatScheduled(b.scheduledAt)}</span>
                      </div>
                      <ChevronRight
                        className="h-4.5 w-4.5 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600 shrink-0"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{partnerStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom: 4-Step Progress Stepper */}
                <div
                  className="mt-3.5 pt-1"
                  role="img"
                  aria-label={`Progress: ${config.label}, step ${config.activeStep + 1} of ${config.steps.length}`}
                >
                  {/* Step Circles and Connecting Lines */}
                  <div className="flex items-center">
                    {config.steps.map((_, idx) => (
                      <Fragment key={idx}>
                        {/* Circle */}
                        <div className="flex items-center justify-center shrink-0">
                          {idx <= config.activeStep ? (
                            <span
                              className={clsx(
                                "flex h-5 w-5 items-center justify-center rounded-full text-white shadow-xs transition-colors",
                                config.activeBg
                              )}
                            >
                              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E2E8F0] transition-colors">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                          )}
                        </div>

                        {/* Connecting Line to next step */}
                        {idx < config.steps.length - 1 && (
                          <div
                            className={clsx(
                              "h-[2px] flex-1 mx-1 rounded-full transition-colors",
                              idx < config.activeStep ? config.lineBg : "bg-slate-200"
                            )}
                          />
                        )}
                      </Fragment>
                    ))}
                  </div>

                  {/* Step Labels */}
                  <div className="mt-1.5 flex justify-between">
                    {config.steps.map((step, idx) => (
                      <span
                        key={idx}
                        className={clsx(
                          "text-[10px] sm:text-[11px] truncate w-16 sm:w-20",
                          idx === 0
                            ? "text-left"
                            : idx === config.steps.length - 1
                              ? "text-right"
                              : "text-center",
                          idx <= config.activeStep
                            ? "font-semibold text-slate-700"
                            : "font-medium text-slate-400"
                        )}
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
