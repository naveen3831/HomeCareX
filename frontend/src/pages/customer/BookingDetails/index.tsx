import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
  CalendarDays,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock,
  Compass,
  CreditCard,
  Download,
  FileText,
  Headset,
  Layers,
  MapPin,
  Navigation,
  Phone,
  Printer,
  RotateCcw,
  Star,
  Trash2,
  UserRound,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import BookingThumb from "../Dashboard/sections/BookingThumb";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
} from "@/components/customer";
import { Skeleton } from "@/components/customer/Skeleton";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBooking, useDecideExtraCharge, useInvoice } from "@/hooks/useBooking";
import { customerPath } from "@/routes/customerPath";
import type { BookingDetailView } from "@/types/bookingDetail";
import { PILL_CLASS, formatRating, formatSlot, rupees } from "../Bookings/bookingModel";
import {
  buildPriceBreakdown,
  buildTimeline,
  canCancelBooking,
  canDecideExtraCharges,
  canRescheduleBooking,
  formatBookedOn,
  formatDuration,
  formatPlainDate,
  isCancelledBooking,
  mapsUrl,
  formatMoment,
  paymentMethodLabel,
  paymentSummary,
  statusPill,
  weekdayOf,
  refundBadge,
} from "./bookingDetailModel";
import CancelDialog from "./components/CancelDialog";
import ExtraChargeApproval from "./components/ExtraChargeApproval";
import InvoiceCard, { printHtml, saveHtml, withLogo } from "./components/InvoiceCard";
import BookAgainButton from "./components/BookAgainButton";
import OtpDisplay from "./components/OtpDisplay";
import PartnerCard from "./components/PartnerCard";
import PriceBreakdown from "./components/PriceBreakdown";
import RateExperience from "./components/RateExperience";
import RescheduleDialog from "./components/RescheduleDialog";
import StatusTimeline from "./components/StatusTimeline";

const LINK_BUTTON =
  "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition hover:opacity-95";

/** Phases in which live tracking makes sense. */
const TRACKABLE = new Set(["assigned", "en_route", "arrived", "in_progress"]);

function Section({
  id,
  title,
  icon: Icon,
  children,
  className,
}: {
  id: string;
  title: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={clsx(
        "min-w-0 rounded-2xl border border-line/80 bg-panel p-5 shadow-[0_2px_8px_rgba(30,27,46,0.03)] sm:p-6",
        className,
      )}
    >
      <h2
        id={id}
        className="mb-4 flex items-center gap-2.5 text-[15px] font-bold text-ink sm:text-base"
      >
        {Icon && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-xl bg-canvas/80 p-4 ring-1 ring-line/80">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel text-brand shadow-xs ring-1 ring-line/60">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-bold text-ink">
          {value}
          {hint && (
            <span className="ml-1.5 text-xs font-normal text-muted">
              {hint}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading booking details"
      className="space-y-4 md:-mt-2"
    >
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

type DecideMutation = ReturnType<typeof useDecideExtraCharge>;

function serviceNameOf(b: BookingDetailView): string {
  return (
    b.priceSnapshot?.lines?.find((l) => l.kind === "BASE")?.name ||
    b.serviceName ||
    "Home Service"
  );
}

export default function BookingDetails() {
  const { id } = useParams<{ id: string }>();
  const online = useOnlineStatus();
  const query = useBooking(id);
  const decide = useDecideExtraCharge(id ?? "");

  const shell = (children: ReactNode) => (
    <div className="mx-auto w-full max-w-xl md:mx-0 md:max-w-none min-w-0 outline-none pb-28 sm:pb-8">
      {children}
    </div>
  );

  if (!id) return shell(<NotFound />);
  if (query.isPending) return shell(<DetailsSkeleton />);

  if (query.isError && !query.data) {
    const { status, code, message } = query.error;
    // 400 = malformed id, 404 = missing or someone else's booking. Same answer on purpose.
    if (status === 404 || status === 400) return shell(<NotFound />);
    if (!online || status === 0 || code === "NETWORK_ERROR") {
      return shell(<OfflineState onRetry={() => void query.refetch()} />);
    }
    return shell(
      <ErrorState
        title="We couldn't load this booking"
        message={message}
        onRetry={() => void query.refetch()}
      />,
    );
  }

  const booking = query.data;
  if (!booking) return shell(<LoadingState label="Loading your booking…" />);

  return shell(
    <DetailsBody
      booking={booking}
      online={online}
      refetchFailed={query.isError}
      decide={decide}
    />,
  );
}

function DetailsBody({
  booking,
  online,
  refetchFailed,
  decide,
}: {
  booking: BookingDetailView;
  online: boolean;
  refetchFailed: boolean;
  decide: DecideMutation;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobileTab, setMobileTab] = useState<"overview" | "details" | "actions">("overview");
  const [imgFailed, setImgFailed] = useState(false);
  const [dialog, setDialog] = useState<"cancel" | "reschedule" | null>(null);
  const location = useLocation();

  const handleMobileTabChange = (tab: "overview" | "details" | "actions") => {
    setMobileTab(tab);
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  
  const bookingId = String(booking._id || (booking as { id?: string }).id || "");
  const normalizedStatus = String(booking.status || "").toLowerCase();
  const pill = statusPill(booking);
  const code =
    booking.bookingNumber || (bookingId ? `BK-${bookingId.slice(-5).toUpperCase()}` : "BK-BOOKING");
  const name = serviceNameOf(booking);
  const timeline = buildTimeline(booking);
  const price = buildPriceBreakdown(booking);
  const payment = paymentSummary(booking);
  const pay = booking.paymentDetails;
  const address = booking.addressSnapshot;
  const cancelled = isCancelledBooking(booking);
  const finished = normalizedStatus === "completed" || normalizedStatus === "rated";
  const active = !finished && !cancelled && normalizedStatus !== "disputed";
  // Same guards as the server's state machine; the server still has the final say.
  const canCancel = active && canCancelBooking(booking.status);
  const canReschedule =
    active &&
    canRescheduleBooking(booking.status) &&
    Boolean(booking.serviceId && booking.date && booking.slot);
  const showOtp =
    Boolean(booking.partnerId) &&
    (normalizedStatus === "arrived" || Boolean(booking.startOtp));
  const hasPendingExtraCharges = (booking.extraCharges ?? []).some(
    (c) => c.status === "pending",
  );
  const isPaid = String(booking.paymentStatus || "").toUpperCase() === "PAID";
  const refund = booking.refund;
  const refundPill = refundBadge(refund, booking.refundStatus);
  const showRefundCard = cancelled && refund && refund.status !== "NOT_REQUIRED";
  const addOnLines = (booking.priceSnapshot?.lines ?? []).filter(
    (l) => l.kind === "ADDON",
  );
  const service = booking.service;
  const day = weekdayOf(booking.date);
  const dateFormatted = formatPlainDate(booking.date);
  const slotFormatted = formatSlot(booking.slot);
  const bookedOn = formatBookedOn(booking.createdAt);
  const duration = formatDuration(
    service?.durationMinutes || (booking as { durationMinutes?: number }).durationMinutes,
  );
  const maps = mapsUrl(address);
  const paidOn = formatMoment(pay?.paidAt);
  const methodText = paymentMethodLabel(pay?.method);
  const txn = pay?.transactionId || pay?.paymentId;
  const supportHref = `${customerPath("/support")}?booking=${encodeURIComponent(bookingId)}`;
  const scheduledAt = (booking as { scheduledAt?: string | Date }).scheduledAt;
  const slotHours = (() => {
    const m = /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/.exec(
      booking.slot || "",
    );
    if (!m) return "";
    const [startH, startM, endH, endM] = [m[1], m[2], m[3], m[4]].map(Number);
    const mins = endH * 60 + endM - (startH * 60 + startM);
    return mins > 0 ? formatDuration(mins) : "";
  })();

  const invoice = useInvoice(bookingId);

  async function handleInvoice(action: "download" | "print") {
    if (invoice.isPending || !isPaid) return;
    try {
      const rawHtml = await invoice.mutateAsync();
      const html = await withLogo(rawHtml);
      const filename = `invoice-${code.toLowerCase()}.html`;
      if (action === "download") {
        saveHtml(html, filename);
      } else {
        printHtml(html);
      }
    } catch {
      // handled
    }
  }

  const partner =
    booking.partner ||
    (typeof booking.partnerId === "object" && booking.partnerId !== null
      ? (booking.partnerId as unknown as NonNullable<typeof booking.partner>)
      : null);

  return (
    <>
      {isMobile ? (
        /* Mobile Redesign (Overview | Details | Actions) */
        <div className="-mt-2 space-y-3.5 md:hidden">

          {/* Segmented 3-Tab Bar: Sticky under TopBar so it stays pinned while scrolling */}
          <div
            className="sticky z-20 -mx-4 bg-canvas px-4 pb-2.5 pt-1.5 border-b border-line/40 shadow-xs"
            style={{ top: "calc(64px + env(safe-area-inset-top, 0px))" }}
          >
            <div className="grid grid-cols-3 rounded-2xl bg-[#f4f5f8] p-1.5 gap-1">
              <button
                type="button"
                onClick={() => handleMobileTabChange("overview")}
                className={clsx(
                  "flex items-center justify-center rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all",
                  mobileTab === "overview"
                    ? "bg-[#4338ca] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => handleMobileTabChange("details")}
                className={clsx(
                  "flex items-center justify-center rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all",
                  mobileTab === "details"
                    ? "bg-[#4338ca] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => handleMobileTabChange("actions")}
                className={clsx(
                  "flex items-center justify-center rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all",
                  mobileTab === "actions"
                    ? "bg-[#4338ca] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Actions
              </button>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {mobileTab === "overview" && (
            <div className="space-y-3.5">
              {/* Status Banner Card */}
              <div className="rounded-2xl border border-emerald-100/60 bg-[#edf9f0] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0",
                      pill.tone === "brand"
                        ? "bg-[#eeebf9] text-[#4338ca]"
                        : pill.tone === "green"
                        ? "bg-[#dcfce7] text-[#15803d]"
                        : pill.tone === "red"
                        ? "bg-red-50 text-red-700"
                        : pill.tone === "amber"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-[#eeebf9] text-[#4338ca]",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {pill.label}
                  </span>
                  <div className="text-right shrink-0">
                    <span className="block text-[11px] font-medium leading-none text-slate-400">
                      Booking ID
                    </span>
                    <span className="mt-1 block text-xs sm:text-[13px] font-bold leading-tight text-slate-800">
                      {code}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600 font-normal">
                  {normalizedStatus === "in_progress" || normalizedStatus === "en_route" || normalizedStatus === "arrived"
                    ? "Your service is scheduled. Our partner will reach you soon."
                    : normalizedStatus === "completed" || normalizedStatus === "rated"
                    ? "Your service has been completed successfully."
                    : normalizedStatus.startsWith("cancel")
                    ? "This booking has been cancelled."
                    : "Your service is scheduled. Our partner will reach you soon."}
                </p>
              </div>

              {/* Pending Extra Charges Alert Banner */}
              {hasPendingExtraCharges && (
                <div
                  role="region"
                  aria-label="Pending Extra Charge Approval"
                  className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm"
                >
                  <CircleAlert
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-amber-950">
                      Your partner requested extra charges
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900">
                      Review and approve or reject to continue the service.
                    </p>
                  </div>
                </div>
              )}

              {/* Service Info Card */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                {service?.image && !imgFailed ? (
                  <img
                    src={service.image}
                    alt={name}
                    onError={() => setImgFailed(true)}
                    className="h-20 w-20 sm:h-22 sm:w-22 shrink-0 rounded-2xl object-cover ring-1 ring-slate-100"
                  />
                ) : (
                  <BookingThumb
                    serviceName={name}
                    className="h-20 w-20 sm:h-22 sm:w-22 shrink-0 rounded-2xl"
                  />
                )}
                <div className="min-w-0 flex-1 flex flex-col justify-start">
                  <h2 className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-snug">
                    {name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {service?.description || "Keep your home fresh and clean with our professional service."}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {duration && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {duration}
                      </span>
                    )}
                    {service?.categoryName && (
                      <span className="inline-flex items-center rounded-lg bg-[#eeebf9] px-2.5 py-0.5 text-[11px] font-semibold text-[#4338ca]">
                        {service.categoryName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Extra Charges Section */}
              {(booking.extraCharges?.length ?? 0) > 0 && (
                <ExtraChargeApproval
                  charges={booking.extraCharges}
                  canDecide={canDecideExtraCharges(booking.status)}
                  onDecide={(chargeId, decision) =>
                    decide.mutateAsync({ chargeId, decision })
                  }
                />
              )}

              {/* Service Partner Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Service Partner</h3>
                </div>

                {partner ? (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {partner.avatar ? (
                        <img
                          src={partner.avatar}
                          alt={partner.name || ""}
                          className="h-11 w-11 rounded-full object-cover shrink-0 ring-1 ring-slate-100"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eeebf9] text-[#4338ca] font-bold text-base">
                          {partner.name ? partner.name.trim().charAt(0).toUpperCase() : "P"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {partner.name || "Assigned Partner"}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          <span className="font-semibold text-slate-900">{formatRating(partner.rating) || "4.7"}</span>
                          <span>({partner.ratingCount || "120"}+ services)</span>
                        </div>
                      </div>
                    </div>

                    {partner.phone ? (
                      <a
                        href={`tel:${partner.phone}`}
                        aria-label={`Call ${partner.name || "partner"}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0eeff] text-[#4338ca] shadow-2xs hover:bg-[#e4dff7] transition active:scale-95"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    ) : (
                      <span
                        aria-label="Call partner"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0eeff] text-[#4338ca]"
                      >
                        <Phone className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-2 text-xs text-slate-500">
                    <UserRound className="h-5 w-5 text-slate-400" />
                    <span>Finding the best partner for your booking...</span>
                  </div>
                )}
              </div>

              {/* OTP Display if active */}
              {showOtp && <OtpDisplay code={booking.startOtp} />}

              {/* Bottom Track CTA */}
              {TRACKABLE.has(normalizedStatus) ? (
                <Link
                  to={customerPath(`/bookings/${encodeURIComponent(bookingId)}/track`)}
                  state={{ from: location.state?.from || customerPath(`/bookings/${encodeURIComponent(bookingId)}`) }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4338ca] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#3730a3] active:scale-[0.99]"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Track Service Partner</span>
                </Link>
              ) : finished ? (
                <BookAgainButton booking={booking} className="w-full py-3.5 rounded-2xl bg-[#4338ca] text-white shadow-md text-sm font-semibold" />
              ) : null}
            </div>
          )}

          {/* TAB 2: DETAILS */}
          {mobileTab === "details" && (
            <div className="space-y-3.5">
              {/* Schedule Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Schedule</h3>
                </div>

                {/* Service Date Row */}
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f2fa] text-[#4338ca]">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">Service Date</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {dateFormatted} {day && <span className="text-xs font-normal text-slate-500">({day})</span>}
                    </p>
                  </div>
                </div>

                {/* Time Slot Row */}
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f2fa] text-[#4338ca]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">Time Slot</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {slotFormatted} {slotHours && <span className="text-xs font-normal text-slate-500">({slotHours})</span>}
                    </p>
                  </div>
                </div>

                {/* Scheduled on banner */}
                <div className="flex items-center gap-3 rounded-xl bg-[#f4f2fb] p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-[#4338ca]">Scheduled on</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {dateFormatted}, {slotFormatted ? slotFormatted.split("–")[0]?.trim() : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Service Address Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Service Address</h3>
                </div>

                {address ? (
                  <div className="pt-1">
                    <p className="text-xs font-bold text-slate-900">{address.line1}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      {[address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ")}
                    </p>
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        <Navigation className="h-3.5 w-3.5 text-[#4338ca]" />
                        <span>View on Maps</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Address details unavailable.</p>
                )}
              </div>

              {/* Extra Charges Section */}
              {(booking.extraCharges?.length ?? 0) > 0 && (
                <ExtraChargeApproval
                  charges={booking.extraCharges}
                  canDecide={canDecideExtraCharges(booking.status)}
                  onDecide={(chargeId, decision) =>
                    decide.mutateAsync({ chargeId, decision })
                  }
                />
              )}

              {/* Price Details Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <Layers className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Price Details</h3>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  {price.rows.map((row) => {
                    const isDiscount = Boolean(row.negative) || row.amount < 0;
                    return (
                      <div key={row.key} className="flex items-center justify-between">
                        <span className={clsx(isDiscount ? "text-emerald-700 font-medium" : "text-slate-600")}>
                          {row.label}
                        </span>
                        <span className={clsx("font-semibold", isDiscount ? "text-emerald-700" : "text-slate-900")}>
                          {isDiscount ? `- ${rupees(Math.abs(row.amount))}` : rupees(row.amount)}
                        </span>
                      </div>
                    );
                  })}
                  {price.extraApproved > 0 && (
                    <>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500">Booking total</span>
                        <span className="font-semibold text-slate-900">{rupees(price.total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Approved extra charges</span>
                        <span className="font-semibold text-slate-900">{rupees(price.extraApproved)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Total Amount Box */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f0f2fa] p-3">
                  <span className="text-xs font-bold text-[#4338ca]">
                    {price.extraApproved > 0 ? "Total with extras" : "Total Amount"}
                  </span>
                  <span className="text-sm font-extrabold text-[#4338ca]">
                    {rupees(price.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIONS */}
          {mobileTab === "actions" && (
            <div className="space-y-3.5">
              {/* Payment Details Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Payment Details</h3>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment Method</span>
                    <span className="font-semibold text-slate-900">{methodText || "Online Payment"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment Status</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      {payment.label}
                    </span>
                  </div>
                  {txn && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Transaction ID</span>
                      <span className="font-mono text-xs font-semibold text-slate-900">{txn}</span>
                    </div>
                  )}
                  {(paidOn || bookedOn) && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Date</span>
                      <span className="text-xs font-medium text-slate-900">{paidOn || bookedOn}</span>
                    </div>
                  )}
                </div>

                {/* View Payment Receipt */}
                <button
                  type="button"
                  onClick={() => void handleInvoice("download")}
                  disabled={invoice.isPending || !isPaid}
                  className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    View Payment Receipt
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              {/* Booking Actions Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Booking Actions</h3>
                </div>

                {/* Invoice Box */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <FileText className="h-4 w-4 text-[#4338ca]" />
                      Invoice
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      INV-{code}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isPaid ? "Download or print your tax invoice anytime." : "Available once the payment is complete."}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleInvoice("download")}
                    disabled={invoice.isPending || !isPaid}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4338ca] py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3730a3] disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleInvoice("print")}
                    disabled={invoice.isPending || !isPaid}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4 text-slate-500" />
                    <span>Print / Save PDF</span>
                  </button>

                  {canReschedule && (
                    <button
                      type="button"
                      onClick={() => setDialog("reschedule")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
                    >
                      <CalendarClock className="h-4 w-4 text-slate-500" />
                      <span>Reschedule Booking</span>
                    </button>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setDialog("cancel")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/30 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Cancel Booking</span>
                    </button>
                  )}

                  {finished && <BookAgainButton booking={booking} className="w-full py-3 text-xs font-semibold" />}
                </div>
              </div>

              {/* Rate Your Experience Card */}
              {!cancelled && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eeebf9] text-[#4338ca]">
                      <Star className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">Rate Your Experience</h3>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="h-7 w-7 text-indigo-200 fill-indigo-50/50 stroke-[1.5]"
                      />
                    ))}
                  </div>

                  <Link
                    to={customerPath("/reviews")}
                    className="flex w-full items-center justify-center rounded-xl bg-[#eeebf9] py-3 text-xs font-semibold text-[#4338ca] transition hover:bg-[#e4dff7]"
                  >
                    Write a Review
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Desktop View (hidden md:block) */
        <div className="hidden md:block md:-mt-2">
          {/* Main Page Header */}
          <div className="mb-6 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  Booking Details
                </h1>
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold",
                    PILL_CLASS[pill.tone],
                  )}
                >
                  {pill.dot && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                    />
                  )}
                  {pill.label}
                </span>
                {refundPill && (
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold",
                      PILL_CLASS[refundPill.tone],
                    )}
                  >
                    {refundPill.dot && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                      />
                    )}
                    {refundPill.label}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                <span>
                  Booking ID: <span className="font-semibold text-ink">{code}</span>
                </span>
                {bookedOn && (
                  <>
                    <span className="hidden text-line sm:inline" aria-hidden="true">•</span>
                    <span className="whitespace-nowrap">Booked on {bookedOn}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {refetchFailed && (
            <p
              role="status"
              className="mb-4 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-700"
            >
              {online
                ? "We couldn't refresh the latest status. Showing saved details."
                : "You're offline. Showing the latest details we saved."}
            </p>
          )}

          {hasPendingExtraCharges && (
            <div
              role="region"
              aria-label="Pending Extra Charge Approval"
              className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <CircleAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-amber-900">
                    Action Required: Your partner requested extra charges
                  </p>
                  <p className="text-xs text-amber-800">
                    Review and approve or reject the additional on-site items requested by your service partner.
                  </p>
                </div>
              </div>
              <a
                href="#extra-charges-heading"
                className="inline-flex items-center justify-center shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                Review Charges
              </a>
            </div>
          )}

          {/* Grid Layout: Left Column & Right Sticky Column */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Left Column */}
            <div className="flex min-w-0 flex-col gap-6">
              <Section id="status-heading" title="Booking Status" icon={Activity}>
                <StatusTimeline items={timeline} />
              </Section>

              {showRefundCard && refund && (
                <Section id="refund-details-heading" title="Refund Details" icon={RotateCcw}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            refundPill ? PILL_CLASS[refundPill.tone] : "bg-muted/10 text-muted",
                          )}
                        >
                          {refundPill?.dot && (
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                            />
                          )}
                          {refund.statusLabel || refundPill?.label || "Refund"}
                        </span>
                      </div>
                      {typeof refund.amount === "number" && refund.amount > 0 && (
                        <span className="text-base font-bold text-ink">
                          {rupees(refund.amount)}
                        </span>
                      )}
                    </div>

                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs sm:text-sm">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted">Refund Destination</dt>
                        <dd className="font-semibold text-ink flex items-center gap-1.5">
                          <Wallet className="h-4 w-4 text-brand" />
                          {refund.destination || "HomeCareX Wallet"}
                        </dd>
                      </div>

                      {refund.originalPaidAmount !== undefined && refund.originalPaidAmount > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted">Original Amount Paid</dt>
                          <dd className="font-semibold text-ink">{rupees(refund.originalPaidAmount)}</dd>
                        </div>
                      )}

                      {refund.requestedAt && (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted">Request Date</dt>
                          <dd className="font-semibold text-ink">{formatMoment(refund.requestedAt)}</dd>
                        </div>
                      )}

                      {refund.status === "CREDITED" && refund.creditedAt && (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted">Credited Date</dt>
                          <dd className="font-semibold text-green-700">{formatMoment(refund.creditedAt)}</dd>
                        </div>
                      )}

                      {refund.status === "CREDITED" && refund.walletTransactionRef && (
                        <div className="flex flex-col gap-0.5 sm:col-span-2">
                          <dt className="text-muted">Wallet Transaction Reference</dt>
                          <dd className="font-mono text-xs font-bold text-ink bg-canvas px-2.5 py-1 rounded-md border border-line">
                            {refund.walletTransactionRef}
                          </dd>
                        </div>
                      )}

                      {refund.status === "REJECTED" && (
                        <div className="flex flex-col gap-0.5 sm:col-span-2 rounded-xl bg-danger-soft/60 p-3 border border-danger/20">
                          <dt className="font-semibold text-danger">Rejection Reason</dt>
                          <dd className="text-xs text-ink mt-0.5">
                            {refund.rejectionReason || "No explicit reason was provided."}
                          </dd>
                          {refund.rejectedAt && (
                            <p className="text-[11px] text-muted mt-1.5">
                              Decision date: {formatMoment(refund.rejectedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </dl>

                    {refund.status === "CREDITED" && (
                      <div className="pt-2">
                        <Link
                          to={customerPath("/wallet")}
                          className={clsx(
                            LINK_BUTTON,
                            "w-full bg-brand text-white hover:opacity-90 shadow-sm",
                            FOCUS_RING,
                          )}
                        >
                          <Wallet className="h-4 w-4" />
                          <span>View in Wallet</span>
                        </Link>
                      </div>
                    )}

                    {refund.status === "REJECTED" && (
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <Link
                          to={supportHref}
                          className={clsx(
                            LINK_BUTTON,
                            "flex-1 border border-line bg-canvas text-ink hover:bg-panel",
                            FOCUS_RING,
                          )}
                        >
                          <Headset className="h-4 w-4 text-brand" />
                          <span>Contact Support / Appeal</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {(booking.extraCharges?.length ?? 0) > 0 && (
                <ExtraChargeApproval
                  charges={booking.extraCharges}
                  canDecide={canDecideExtraCharges(booking.status)}
                  onDecide={(chargeId, decision) =>
                    decide.mutateAsync({ chargeId, decision })
                  }
                />
              )}

              <Section id="service-heading" title="Service Details" icon={Wrench}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {service?.image && !imgFailed ? (
                    <img
                      src={service.image}
                      alt={name}
                      onError={() => setImgFailed(true)}
                      className="h-28 w-full shrink-0 rounded-xl object-cover ring-1 ring-line sm:h-24 sm:w-24"
                    />
                  ) : (
                    <BookingThumb
                      serviceName={name}
                      className="h-28 w-full shrink-0 rounded-xl sm:h-24 sm:w-24"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-ink">
                        {name}
                      </h3>
                    </div>
                    {service?.description && (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">
                        {service.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {duration && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
                          <Clock className="h-3.5 w-3.5 text-muted" />
                          {duration}
                        </span>
                      )}
                      {service?.categoryName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                          {service.categoryName}
                        </span>
                      )}
                      {booking.quantity && booking.quantity > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
                          Qty: {booking.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {addOnLines.length > 0 && (
                  <div className="mt-5 border-t border-line/80 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Add-ons included
                    </p>
                    <ul className="mt-2 divide-y divide-line/60">
                      {addOnLines.map((addon) => (
                        <li
                          key={String(addon.refId ?? addon.name)}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <span className="text-ink">
                            {addon.name}
                            {addon.quantity > 1 && (
                              <span className="text-muted">
                                {" "}
                                × {addon.quantity}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-ink">
                            ₹{addon.amount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              <Section id="partner-heading" title="Service Partner" icon={Users}>
                <PartnerCard
                  partner={partner}
                  hasPartner={Boolean(booking.partnerId)}
                  isCancelled={cancelled}
                />
              </Section>

              <Section id="slot-heading" title="Schedule" icon={CalendarDays}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Tile
                    icon={CalendarDays}
                    label="Service Date"
                    value={dateFormatted}
                    hint={day ? `(${day})` : undefined}
                  />
                  <Tile
                    icon={Clock}
                    label="Time Slot"
                    value={slotFormatted}
                    hint={slotHours ? `(${slotHours})` : undefined}
                  />
                </div>
                {scheduledAt && (
                  <p className="mt-3 text-xs text-muted">
                    Scheduled instant: {formatMoment(scheduledAt)}
                  </p>
                )}
              </Section>

              <Section id="address-heading" title="Service Address" icon={MapPin}>
                {address ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {address.line1}
                      </p>
                      {address.line2 && (
                        <p className="text-xs text-muted">{address.line2}</p>
                      )}
                      <p className="text-xs text-muted">
                        {[address.city, address.state, address.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clsx(
                          LINK_BUTTON,
                          "self-start border border-line bg-canvas text-xs text-ink hover:bg-panel shadow-2xs",
                          FOCUS_RING,
                        )}
                      >
                        <Navigation className="h-3.5 w-3.5 text-brand" />
                        <span>View on Maps</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Address details unavailable for this booking.
                  </p>
                )}
              </Section>

              {/* Start OTP: bottom of the left column */}
              {showOtp && <OtpDisplay code={booking.startOtp} />}
            </div>

            {/* Right Column (Sticky on large screens) */}
            <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
              <Section id="price-heading" title="Price Breakdown" icon={Layers}>
                <PriceBreakdown model={price} />
              </Section>

              <Section
                id="payment-heading"
                title="Payment Details"
                icon={CreditCard}
              >
                <dl className="space-y-3">
                  <Row label="Payment Status">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        PILL_CLASS[payment.tone],
                      )}
                    >
                      {payment.label}
                    </span>
                  </Row>
                  {methodText && <Row label="Payment Method">{methodText}</Row>}
                  {txn && (
                    <Row label="Transaction ID">
                      <span className="font-mono text-xs">{txn}</span>
                    </Row>
                  )}
                  {paidOn && <Row label="Paid On">{paidOn}</Row>}
                </dl>
              </Section>

              <Section id="actions-heading" title="Booking Actions" icon={Zap}>
                <div className="flex flex-col gap-2.5">
                  {showRefundCard && refund && (
                    <div className="rounded-xl border border-line bg-canvas/70 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                          Refund Status
                        </span>
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            refundPill ? PILL_CLASS[refundPill.tone] : "bg-muted/10 text-muted",
                          )}
                        >
                          {refundPill?.dot && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          )}
                          {refund.statusLabel || refundPill?.label || "Refund"}
                        </span>
                      </div>

                      {typeof refund.amount === "number" && refund.amount > 0 && (
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-muted">
                            {refund.status === "CREDITED" ? "Credited Amount" : "Refund Amount"}
                          </span>
                          <span className="font-bold text-ink">
                            {rupees(refund.amount)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Destination</span>
                        <span className="font-medium text-ink flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5 text-brand" />
                          HomeCareX Wallet
                        </span>
                      </div>

                      {refund.status === "CREDITED" && refund.walletTransactionRef && (
                        <div className="text-[11px] text-muted">
                          <span>Ref: </span>
                          <span className="font-mono text-ink font-medium">
                            {refund.walletTransactionRef}
                          </span>
                        </div>
                      )}

                      {refund.status === "CREDITED" && (
                        <Link
                          to={customerPath("/wallet")}
                          className={clsx(
                            LINK_BUTTON,
                            "w-full mt-1 bg-brand text-white hover:opacity-90",
                            FOCUS_RING,
                          )}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          <span>Check Wallet Balance</span>
                        </Link>
                      )}

                      {refund.status === "REJECTED" && (
                        <div className="mt-1 pt-1.5 border-t border-line text-[11px]">
                          <p className="text-danger font-medium">
                            Reason: {refund.rejectionReason || "Rejected by admin"}
                          </p>
                          <Link
                            to={supportHref}
                            className="mt-1.5 inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                          >
                            <Headset className="h-3 w-3" />
                            <span>Appeal Decision</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                  <InvoiceCard
                    bookingId={bookingId}
                    bookingCode={code}
                    enabled={isPaid}
                    isCancelled={cancelled}
                  />
                  {TRACKABLE.has(normalizedStatus) && (
                    <Link
                      to={customerPath(`/bookings/${encodeURIComponent(bookingId)}/track`)}
                      state={{ from: location.state?.from || customerPath(`/bookings/${encodeURIComponent(bookingId)}`) }}
                      className={clsx(
                        LINK_BUTTON,
                        "border border-brand/30 bg-panel text-brand",
                        "hover:border-brand hover:bg-brand-soft hover:text-ink",
                        FOCUS_RING,
                      )}
                    >
                      <Compass className="h-4 w-4" aria-hidden="true" />
                      <span>Track Partner</span>
                    </Link>
                  )}
                  {canReschedule && (
                    <button
                      type="button"
                      onClick={() => setDialog("reschedule")}
                      className={clsx(
                        LINK_BUTTON,
                        "border border-line bg-panel text-ink hover:border-brand/40 hover:bg-canvas",
                        FOCUS_RING,
                      )}
                    >
                      <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" />
                      Reschedule Booking
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setDialog("cancel")}
                      className={clsx(
                        LINK_BUTTON,
                        "border border-danger/30 bg-panel text-danger hover:bg-danger-soft/50",
                        FOCUS_RING,
                      )}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Cancel Booking
                    </button>
                  )}
                  {!cancelled && <RateExperience bookingId={bookingId} status={booking.status} />}
                  <BookAgainButton booking={booking} />
                </div>
              </Section>

              <section className="rounded-2xl border border-line/80 bg-panel p-5 shadow-[0_2px_8px_rgba(30,27,46,0.03)] sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Headset className="h-4 w-4 text-brand" aria-hidden="true" />
                  Need Help?
                </h2>
                <p className="mt-1.5 text-xs text-muted">
                  Have questions or need assistance regarding this booking? Our support team is here to help.
                </p>
                <Link
                  to={supportHref}
                  className={clsx(
                    LINK_BUTTON,
                    "mt-3.5 w-full border border-line bg-canvas text-xs font-semibold text-ink hover:border-brand/40 hover:bg-panel",
                    FOCUS_RING,
                  )}
                >
                  Contact Support
                </Link>
              </section>
            </div>
          </div>
        </div>
      )}

      {dialog === "cancel" && (
        <CancelDialog bookingId={bookingId} onClose={() => setDialog(null)} />
      )}
      {dialog === "reschedule" && (
        <RescheduleDialog
          bookingId={bookingId}
          serviceId={booking.serviceId}
          date={booking.date}
          slot={booking.slot}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function NotFound() {
  return (
    <EmptyState
      title="We couldn't find this booking"
      description="It may have been removed, or the link is wrong."
      action={
        <Link
          to={customerPath("/bookings")}
          className={clsx(LINK_BUTTON, "bg-brand text-white", FOCUS_RING)}
        >
          Back to my bookings
        </Link>
      }
    />
  );
}
