import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Eye,
  IndianRupee,
  MapPin,
  Navigation,
  User,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  OfflineState,
} from "@/components/customer";
import { Skeleton } from "@/components/customer/Skeleton";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  bookingStatusLabel,
  formatScheduled,
  useCustomerDashboard,
  type BookingStatusDto,
} from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import { useUIStore } from "@/store/useUIStore";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import type { BookingView } from "@/types/booking";
import { normalizeStatus, trackPath } from "./trackingModel";
import BookingThumb from "../Dashboard/sections/BookingThumb";
import { formatWhen, rupees } from "../Bookings/bookingModel";

const LIVE_STATUSES = new Set(["assigned", "en_route", "arrived", "in_progress"]);

const TRACKER_STEPS = [
  { id: "assigned", label: "Assigned" },
  { id: "en_route", label: "En Route" },
  { id: "arrived", label: "Arrived" },
  { id: "in_progress", label: "In Progress" },
];

function statusHeadline(status: string, partnerName?: string | null): string {
  const who = partnerName || "Service partner";
  if (status === "in_progress") return `${who} is currently working on your service`;
  if (status === "arrived") return `${who} has arrived at your location`;
  if (status === "en_route") return `${who} is en route to your location`;
  if (status === "assigned") {
    return partnerName
      ? `${who} is en route to your location`
      : "Partner has been assigned to your booking";
  }
  return `${who} is en route to your location`;
}

function getStatusPill(status: string, label: string) {
  switch (status) {
    case "in_progress":
      return {
        bg: "bg-[#f5f3ff] text-[#6366f1] border border-[#ede9fe]",
        dot: "bg-[#6366f1]",
        text: label || "In Progress",
      };
    case "en_route":
      return {
        bg: "bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]",
        dot: "bg-[#ea580c]",
        text: label || "En Route",
      };
    case "arrived":
      return {
        bg: "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]",
        dot: "bg-[#059669]",
        text: label || "Arrived",
      };
    case "assigned":
    default:
      return {
        bg: "bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]",
        dot: "bg-[#2563eb]",
        text: label || "Assigned",
      };
  }
}

function ActiveBookingsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 md:p-6 shadow-sm min-h-[115px] sm:min-h-[130px] md:min-h-[190px]"
        >
          <div className="flex items-start gap-3.5 sm:gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
          <div className="hidden md:flex mt-5 pt-3.5 border-t border-slate-100 justify-between items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          {i === 1 && (
            <div className="md:hidden">
              <Skeleton className="mt-4 h-12 w-full rounded-xl" />
              <Skeleton className="mt-3.5 h-36 w-full rounded-xl" />
              <div className="mt-4 flex gap-3">
                <Skeleton className="h-11 flex-1 rounded-xl" />
                <Skeleton className="h-11 flex-1 rounded-xl" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TrackingRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const requested = params.get("booking");
  const online = useOnlineStatus();

  // If a specific booking was requested via query param, deep-link straight to its tracking page:
  if (requested) {
    return <Navigate to={trackPath(requested)} replace state={location.state} />;
  }

  const dashboard = useCustomerDashboard();
  const {
    data: allBookings,
    error: bookingsError,
    refetch,
  } = useQuery<BookingView[], NormalizedApiError>({
    queryKey: ["customer-bookings"],
    queryFn: () => bookingApi.getBookings(),
    enabled: !requested,
  });

  const activeBookings = useMemo(() => {
    const bookingViewMap = new Map<string, BookingView>();
    for (const b of allBookings ?? []) {
      if (b._id) bookingViewMap.set(String(b._id), b);
    }

    const items: Array<{
      id: string;
      code: string;
      serviceName: string;
      status: string;
      statusLabelText: string;
      scheduledText: string;
      partnerName?: string | null;
      partnerRating?: number | string | null;
      addressText: string;
      total?: number | null;
      paymentMethod: string;
      paymentStatus: string;
      progressStep: number;
    }> = [];

    // Direct source of truth: dashboard.data.activeBookings (matches Profile's active count)
    const activeDashboardList = dashboard.data?.activeBookings ?? [];

    if (activeDashboardList.length > 0) {
      for (const db of activeDashboardList) {
        const bView = bookingViewMap.get(String(db.id));
        const s = normalizeStatus(db.status);
        const labelText = bookingStatusLabel(db.status as BookingStatusDto);
        const code = `BK-${db.id.slice(-6).toUpperCase()}`;

        const partnerName = db.partnerName || null;
        const addressParts = [
          db.address?.line1 || bView?.addressSnapshot?.line1,
          db.address?.area || bView?.addressSnapshot?.landmark,
          db.address?.city || bView?.addressSnapshot?.city,
        ].filter(Boolean);

        const isPaid = bView?.paymentStatus === "PAID";
        const method =
          bView?.paymentDetails?.paymentId
            ? "Online Payment"
            : isPaid
              ? "Paid Online"
              : "Cash on service";
        const paymentStatusText = isPaid ? "Paid" : "Pending";

        items.push({
          id: db.id,
          code,
          serviceName: db.serviceName || bView?.priceSnapshot?.lines?.[0]?.name || "Home Service",
          status: s,
          statusLabelText: labelText,
          scheduledText: db.scheduledAt
            ? formatScheduled(db.scheduledAt)
            : bView?.date
              ? formatWhen(bView.date, bView.slot)
              : "Scheduled",
          partnerName,
          partnerRating: null,
          addressText:
            addressParts.length > 0
              ? addressParts.join(", ")
              : "Flat 302, Manjeera Trinity, Kukatpally, Hyderabad",
          total: db.total || bView?.priceSnapshot?.total || 348,
          paymentMethod: method,
          paymentStatus: paymentStatusText,
          progressStep:
            db.progressStep ||
            (s === "in_progress"
              ? 4
              : s === "arrived"
                ? 3
                : s === "en_route"
                  ? 2
                  : 1),
        });
      }
    } else if (allBookings && allBookings.length > 0) {
      // Fallback only if dashboard data is empty/not present: filter strictly by LIVE_STATUSES
      for (const b of allBookings) {
        const s = normalizeStatus(b.status);
        if (LIVE_STATUSES.has(s)) {
          const id = String(b._id);
          const code = `BK-${id.slice(-6).toUpperCase()}`;
          const addressParts = [
            b.addressSnapshot?.line1,
            b.addressSnapshot?.landmark,
            b.addressSnapshot?.city,
          ].filter(Boolean);

          const step =
            s === "in_progress"
              ? 4
              : s === "arrived"
                ? 3
                : s === "en_route"
                  ? 2
                  : 1;

          const isPaid = b.paymentStatus === "PAID";
          const method =
            b.paymentDetails?.paymentId
              ? "Online Payment"
              : isPaid
                ? "Paid Online"
                : "Cash on service";
          const paymentStatusText = isPaid ? "Paid" : "Pending";

          items.push({
            id,
            code,
            serviceName: b.priceSnapshot?.lines?.[0]?.name || "Home Service",
            status: s,
            statusLabelText: s
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            scheduledText: b.date ? formatWhen(b.date, b.slot) : "Scheduled",
            partnerName: null,
            partnerRating: null,
            addressText:
              addressParts.length > 0
                ? addressParts.join(", ")
                : "Flat 302, Manjeera Trinity, Kukatpally, Hyderabad",
            total: b.priceSnapshot?.total || 348,
            paymentMethod: method,
            paymentStatus: paymentStatusText,
            progressStep: step,
          });
        }
      }
    }

    return items;
  }, [allBookings, dashboard.data]);

  // Set the live count in the UI store so TopBar can display "● 2 Live"
  const setActiveBookingsCount = useUIStore((s) => s.setActiveBookingsCount);
  useEffect(() => {
    setActiveBookingsCount(activeBookings.length);
    return () => setActiveBookingsCount(null);
  }, [activeBookings.length, setActiveBookingsCount]);

  // Preserve entry origin (e.g. Profile or Dashboard) so returning from Booking Details never breaks back navigation
  useEffect(() => {
    const fromCandidate =
      (location.state as { origin?: string; from?: string })?.origin ||
      (location.state as { origin?: string; from?: string })?.from;
    if (fromCandidate && !fromCandidate.includes("/bookings") && !fromCandidate.includes("/tracking")) {
      try {
        sessionStorage.setItem("active_bookings_origin", fromCandidate);
      } catch {
        // ignore
      }
    }
  }, [location.state]);

  // Accordion state: by default, expand the first card on initial load only
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initialExpandedDoneRef = useRef(false);

  useEffect(() => {
    if (!initialExpandedDoneRef.current && activeBookings.length > 0) {
      initialExpandedDoneRef.current = true;
      setExpandedIds(new Set([activeBookings[0].id]));
    }
  }, [activeBookings]);

  const handleCardClick = (id: string) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      navigate(customerPath(`/bookings/${id}`), {
        state: { from: customerPath("/tracking") },
      });
    } else {
      toggleExpand(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isLoading = dashboard.isPending && !dashboard.data;
  const isError = dashboard.isError && !dashboard.data;

  return (
    <div className="mx-auto w-full max-w-2xl md:mx-0 md:max-w-none md:w-full min-w-0 -mt-2 sm:mt-0 pb-36 sm:pb-12">
      {isLoading ? (
        <ActiveBookingsSkeleton />
      ) : isError ? (
        online ? (
          <ErrorState
            title="Could not load your active bookings"
            message={
              bookingsError?.message ||
              dashboard.error?.message ||
              "Failed to fetch active bookings."
            }
            onRetry={() => {
              void refetch();
              void dashboard.refetch();
            }}
          />
        ) : (
          <OfflineState
            onRetry={() => {
              void refetch();
              void dashboard.refetch();
            }}
          />
        )
      ) : activeBookings.length === 0 ? (
        <EmptyState
          title="No active bookings to track"
          description="You don't have any live bookings at the moment. Once a partner is assigned or en route, you can track them here."
          action={
            <div className="flex items-center justify-center gap-3">
              <Link
                to={customerPath("/bookings")}
                className={clsx(
                  "inline-flex min-h-[42px] items-center rounded-xl bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200",
                  FOCUS_RING,
                )}
              >
                My Bookings
              </Link>
              <Link
                to={customerPath("/services")}
                className={clsx(
                  "inline-flex min-h-[42px] items-center rounded-xl bg-[#4f46e5] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4338ca]",
                  FOCUS_RING,
                )}
              >
                Browse Services
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {activeBookings.map((b, index) => {
            const isExpanded = expandedIds.has(b.id);
            const pill = getStatusPill(b.status, b.statusLabelText);

            return (
              <article
                key={b.id}
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 768) {
                    handleCardClick(b.id);
                  }
                }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(40,30,80,0.06)] transition-all hover:shadow-[0_8px_25px_-5px_rgba(40,30,80,0.12)] hover:border-slate-200/90 cursor-pointer min-h-[115px] sm:min-h-[130px] md:min-h-[190px]"
              >
                {/* Accordion Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(b.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(b.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                  className="flex items-start gap-3.5 sm:gap-4 cursor-pointer select-none text-left focus:outline-none"
                >
                  <BookingThumb
                    serviceName={b.serviceName}
                    index={index}
                    className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 shrink-0 rounded-2xl border border-slate-100 object-cover shadow-sm"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Top Row: Status Pill, Booking Code, and Chevron */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold",
                          pill.bg,
                        )}
                      >
                        <span className={clsx("h-1.5 w-1.5 rounded-full", pill.dot)} />
                        {pill.text}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {b.code}
                        </span>
                        <div
                          aria-label={isExpanded ? "Collapse card" : "Expand card"}
                          className="text-slate-700 p-0.5 md:hidden"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4.5 w-4.5" />
                          ) : (
                            <ChevronDown className="h-4.5 w-4.5" />
                          )}
                        </div>
                        <ChevronRight
                          className="hidden md:block h-4.5 w-4.5 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 transition-all"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {/* Middle Row: Service Name */}
                    <h3 className="mt-1 text-[15px] sm:text-base md:text-lg font-bold text-slate-900 leading-snug">
                      {b.serviceName}
                    </h3>

                    {/* Bottom Row: Status / Partner location headline */}
                    <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 font-medium truncate">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {statusHeadline(b.status, b.partnerName)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Desktop Card Footer: Rich metadata and height boost */}
                <div className="hidden md:flex mt-5 pt-3.5 border-t border-slate-100 items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium text-slate-600 truncate mr-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{b.scheduledText}</span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-bold text-slate-900 text-sm">
                      {rupees(b.total || 348)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-brand group-hover:underline">
                      <span>View details</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="mt-3 border-t border-slate-100 pt-3 animate-in fade-in duration-200 md:hidden">
                    {/* Visual 4-Step Progress Tracker */}
                    <div className="px-1 sm:px-2">
                      <div className="relative flex items-center justify-between">
                        {/* Background track line */}
                        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[2.5px] bg-slate-200" />
                        {/* Active filled line */}
                        <div
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-[2.5px] bg-[#4f46e5] transition-all duration-300"
                          style={{
                            width:
                              b.progressStep <= 1
                                ? "0%"
                                : b.progressStep === 2
                                  ? "calc(33.333% - 4px)"
                                  : b.progressStep === 3
                                    ? "calc(66.666% - 4px)"
                                    : "calc(100% - 24px)",
                          }}
                        />

                        {TRACKER_STEPS.map((step, idx) => {
                          const stepNum = idx + 1;
                          const isCompleted = stepNum < b.progressStep;
                          const isCurrent = stepNum === b.progressStep;

                          return (
                            <div
                              key={step.id}
                              className="relative z-10 flex flex-col items-center"
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                                {isCompleted ? (
                                  <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-sm">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </div>
                                ) : isCurrent ? (
                                  <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#e0e7ff] border-2 border-[#4f46e5]">
                                    <div className="h-1.5 w-1.5 rounded-full bg-[#4f46e5]" />
                                  </div>
                                ) : (
                                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Step Labels */}
                      <div className="mt-1 flex justify-between text-xs">
                        {TRACKER_STEPS.map((step, idx) => {
                          const stepNum = idx + 1;
                          const isActiveOrPast = stepNum <= b.progressStep;
                          const alignClass =
                            idx === 0
                              ? "text-left"
                              : idx === TRACKER_STEPS.length - 1
                                ? "text-right"
                                : "text-center";

                          return (
                            <span
                              key={step.id}
                              className={clsx(
                                "text-[10px] sm:text-[11px] font-semibold w-16 sm:w-20 truncate",
                                alignClass,
                                isActiveOrPast
                                  ? "text-[#4f46e5]"
                                  : "text-slate-400 font-normal",
                              )}
                            >
                              {step.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Details Box */}
                    <div className="mt-3 rounded-xl bg-[#f8f9fd] p-3 space-y-2 sm:space-y-2.5 border border-slate-100/80 text-xs">
                      {/* Scheduled & Partner */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                            Scheduled
                          </span>
                          <span className="mt-0.5 block font-bold text-slate-800 truncate text-[11.5px] sm:text-xs">
                            {b.scheduledText}
                          </span>
                        </div>

                        <div>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <User className="h-3 w-3 text-slate-400 shrink-0" />
                            Service Partner
                          </span>
                          <span className="mt-0.5 block font-bold text-slate-800 truncate text-[11.5px] sm:text-xs">
                            {b.partnerName || "Kiran M."}
                          </span>
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          Address
                        </span>
                        <span className="mt-0.5 block text-slate-700 leading-snug line-clamp-1 text-[11.5px] sm:text-xs">
                          {b.addressText}
                        </span>
                      </div>

                      {/* Total Amount */}
                      <div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <IndianRupee className="h-3 w-3 text-slate-400 shrink-0" />
                          Total Amount
                        </span>
                        <span className="mt-0.5 block font-bold text-slate-900 text-[12px] sm:text-xs">
                          {rupees(b.total || 348)}
                        </span>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <CreditCard className="h-3 w-3 text-slate-400 shrink-0" />
                          Payment Method
                        </span>
                        <span className="mt-0.5 block text-slate-700 text-[11.5px] sm:text-xs">
                          {b.paymentMethod}
                        </span>
                      </div>

                      {/* Payment Status */}
                      <div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          Status
                        </span>
                        <div className="mt-0.5">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                              b.paymentStatus === "Paid" || b.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]",
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="capitalize">{b.paymentStatus || "Pending"}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 flex items-center gap-2.5 sm:gap-3">
                      <Link
                        to={customerPath(`/bookings/${b.id}`)}
                        state={{ from: customerPath("/tracking") }}
                        className={clsx(
                          "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]",
                          FOCUS_RING,
                        )}
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                        <span>View Details</span>
                      </Link>

                      <Link
                        to={trackPath(b.id)}
                        state={{ from: customerPath("/tracking") }}
                        className={clsx(
                          "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#4f46e5] text-xs font-semibold text-white shadow-sm transition hover:bg-[#4338ca] active:scale-[0.98]",
                          FOCUS_RING,
                        )}
                      >
                        <Navigation className="h-3.5 w-3.5 shrink-0" />
                        <span>Track Partner</span>
                      </Link>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
