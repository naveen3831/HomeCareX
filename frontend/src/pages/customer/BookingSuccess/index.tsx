import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Hash,
  Home,
  MapPin,
  Ticket,
} from "lucide-react";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import { ErrorState, LoadingState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { customerPath } from "@/routes/customerPath";
import { useBookingDraftStore } from "@/features/booking";
import { BOOKING_STATUS, PAYMENT_STATUS, type BookingView } from "@/types/booking";
import BookingThumb from "@/pages/customer/Dashboard/sections/BookingThumb";
import { formatSlot } from "../Bookings/bookingModel";

/** Formats "2026-11-04" -> "November 4, 2026" */
function formatLongDate(dateStr?: string): string {
  if (!dateStr) return "Scheduled Date";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats "2026-11-04" -> "Nov 4, 2026" */
function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats creation timestamp to "Nov 4, 2026 • 02:01 PM" */
function formatTimestamp(isoString?: string): string {
  if (!isoString) {
    const now = new Date();
    return `${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  }
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  const datePart = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} • ${timePart}`;
}

/** Formats slot range like "14:00-16:00" -> "02:00 PM – 04:00 PM" matching reference design */
function formatDisplaySlot(slot?: string): string {
  if (!slot) return "Scheduled Time";
  const range = /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/.exec(slot);
  if (range) {
    const to12 = (h: number, m: number) => {
      const suffix = h >= 12 ? "PM" : "AM";
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
    };
    return `${to12(+range[1], +range[2])} – ${to12(+range[3], +range[4])}`;
  }
  return formatSlot(slot) || slot;
}

/** Identifies payment method in friendly terms */
function resolvePaymentMethod(booking: BookingView): string {
  const anyBooking = booking as {
    paymentMethod?: string;
    paymentDetails?: { method?: string; status?: string };
  };
  const method = anyBooking.paymentMethod || anyBooking.paymentDetails?.method;

  if (method) {
    const m = method.toLowerCase();
    if (m === "cod" || m === "cash") return "Cash on Service";
    if (m === "upi") return "UPI";
    if (m === "card" || m === "credit_card" || m === "debit_card") return "Card";
    if (m === "netbanking" || m === "net_banking") return "Net banking";
    if (m === "wallet") return "Wallet";
    return method.toUpperCase();
  }

  return booking.paymentStatus === PAYMENT_STATUS.PAID ? "UPI" : "Cash on Service";
}

/** 3D Vector Illustration matching the reference design */
function SuccessBadgeIllustration() {
  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 130 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[64px] h-[50px] sm:w-[75px] sm:h-[58px] md:w-[110px] md:h-[84px] drop-shadow-md select-none transform transition-transform hover:scale-105 duration-300"
        aria-hidden="true"
      >
        {/* Sparkles / Ambient Elements */}
        <path d="M48 10L50 15L55 17L50 19L48 24L46 19L41 17L46 15L48 10Z" fill="#10B981" fillOpacity="0.75" />
        <circle cx="20" cy="40" r="3" fill="#34D399" />
        <circle cx="120" cy="30" r="2.5" fill="#6EE7B7" />

        {/* 3D Check Card Base (Tilted pill) */}
        <g transform="rotate(-6 45 45)">
          <rect x="18" y="14" width="56" height="56" rx="16" fill="#F0FDF4" />
          <rect x="18" y="14" width="56" height="56" rx="16" stroke="#D1FAE5" strokeWidth="2" />
          {/* Green 3D Check Circle */}
          <circle cx="46" cy="42" r="21" fill="url(#green_gradient)" />
          <path
            d="M38 42.5L43.5 48L54.5 37"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* 3D Modern House */}
        <g transform="translate(68, 28)">
          {/* Garden Bush / Tree */}
          <circle cx="48" cy="44" r="12" fill="#10B981" />
          <circle cx="4" cy="46" r="8" fill="#34D399" />

          {/* House Base */}
          <rect x="10" y="22" width="40" height="34" rx="6" fill="#FFFFFF" />
          <rect x="10" y="22" width="40" height="34" rx="6" stroke="#E2E8F0" strokeWidth="1.5" />

          {/* Roof (Indigo 3D style) */}
          <path
            d="M6 24L28 4L54 24"
            stroke="#4338CA"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 23L28 5L52 23"
            stroke="#6366F1"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Front Door */}
          <rect x="23" y="36" width="14" height="20" rx="3" fill="#1E1B4B" />

          {/* Window */}
          <circle cx="28" cy="19" r="3.5" fill="#EEF2FF" stroke="#818CF8" strokeWidth="1.5" />
        </g>

        <defs>
          <linearGradient id="green_gradient" x1="25" y1="21" x2="67" y2="63" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/** Small document / receipt graphic for Total Amount box */
function ReceiptBoxGraphic() {
  return (
    <div className="relative mt-1 flex items-center justify-center opacity-85" aria-hidden="true">
      <svg width="58" height="38" viewBox="0 0 70 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft shadow */}
        <ellipse cx="35" cy="45" rx="25" ry="4" fill="#E0E7FF" />
        {/* Paper Sheet */}
        <path
          d="M20 6C20 3.79086 21.7909 2 24 2H46C48.2091 2 50 3.79086 50 6V42L45 39L40 42L35 39L30 42L25 39L20 42V6Z"
          fill="#FFFFFF"
          stroke="#C7D2FE"
          strokeWidth="1.5"
        />
        {/* Lines */}
        <line x1="26" y1="10" x2="44" y2="10" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <line x1="26" y1="16" x2="40" y2="16" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        <line x1="26" y1="22" x2="36" y2="22" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
        {/* Mini verified check badge */}
        <circle cx="48" cy="32" r="8" fill="#818CF8" />
        <path d="M45 32L47.5 34.5L51.5 30" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}



interface BookingSuccessProps {
  /** Pass true when navigated via /booking/booked/:id (Cash on Service flow) */
  isCod?: boolean;
}

export default function BookingSuccess({ isCod = false }: BookingSuccessProps) {
  const { id: bookingId } = useParams<{ id: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery<
    BookingView,
    NormalizedApiError
  >({
    queryKey: ["booking", bookingId],
    queryFn: () => bookingApi.getBooking(bookingId as string),
    enabled: Boolean(bookingId),
    refetchInterval: (query) => {
      return query.state.data?.status === BOOKING_STATUS.PENDING_PAYMENT ? 4000 : false;
    },
  });

  const clearDraft = useBookingDraftStore((s) => s.clearDraft);

  // Clear booking draft once data arrives
  useEffect(() => {
    if (data) clearDraft();
  }, [data, clearDraft]);

  const serviceName = useMemo(() => {
    if (!data) return "Home Service";
    const baseLine = data.priceSnapshot?.lines?.find((l) => l.kind === "BASE");
    return baseLine?.name || (data as { serviceName?: string }).serviceName || "Home Service";
  }, [data]);

  const serviceDescription = useMemo(() => {
    if (!data) return "Professional service for your home";
    return (
      (data as { serviceDescription?: string }).serviceDescription ||
      "Professional home cleaning for a cleaner and healthier home."
    );
  }, [data]);

  const bookingCode = useMemo(() => {
    if (!data?._id) return "#8EDAB7";
    const ref = (data as { bookingNumber?: string }).bookingNumber;
    if (ref) return ref.startsWith("#") ? ref : `#${ref}`;
    return `#${data._id.slice(-6).toUpperCase()}`;
  }, [data]);

  const formattedAddress = useMemo(() => {
    if (!data?.addressSnapshot) return "qw12, T hub 2.0, Inorbit Mall Road, BN Reddy...";
    const a = data.addressSnapshot;
    const parts = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean);
    return parts.join(", ") || "qw12, T hub 2.0, Inorbit Mall Road, BN Reddy...";
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <LoadingState label="Loading booking confirmation…" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <ErrorState
          title="Couldn't load booking confirmation"
          message={error?.message || "Booking details could not be found."}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const isPaid = data.paymentStatus === PAYMENT_STATUS.PAID;
  const paymentMethodLabel = resolvePaymentMethod(data);
  const paymentStatusLabel = isPaid ? "Paid online" : "Pay on service";
  const totalAmount = data.priceSnapshot?.total ?? 741;
  const scheduledDateLong = formatLongDate(data.date);
  const scheduledDateShort = formatShortDate(data.date);
  const scheduledSlotTime = formatDisplaySlot(data.slot);
  const bookingPlacedAt = formatTimestamp(data.createdAt);

  return (
    <div className="w-full bg-transparent font-sans">
      <div className="w-full space-y-3.5 md:space-y-4 lg:space-y-4.5">

        {/* ========================================================================= */}
        {/* 1. BOOKING CONFIRMATION BANNER                                            */}
        {/* ========================================================================= */}
        <section
          aria-label="Booking Confirmation Banner"
          className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-emerald-100 bg-gradient-to-r from-[#dcfce7]/75 via-[#f0fdf4] to-[#ecfdf5]/80 p-3.5 sm:p-4 md:py-4.5 md:px-7 shadow-[0_4px_25px_-5px_rgba(16,185,129,0.08)]"
        >
          {/* Subtle curved ambient waves matching reference template */}
          <svg
            className="pointer-events-none absolute right-0 top-0 bottom-0 h-full w-2/5 opacity-40 select-none"
            viewBox="0 0 400 120"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,0 C120,120 240,-30 400,60 L400,0 Z" fill="#86efac" fillOpacity="0.4" />
            <path d="M80,120 C200,20 300,130 400,30 L400,120 Z" fill="#bbf7d0" fillOpacity="0.3" />
          </svg>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            {/* Left: 3D Checkmark & House Illustration + Title */}
            <div className="flex items-center gap-3.5 sm:gap-4 md:gap-5 min-w-0">
              <SuccessBadgeIllustration />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-[28px] font-extrabold tracking-tight text-slate-900 leading-tight">
                  {isCod ? "Order Placed!" : "Booking Confirmed!"}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {isCod
                    ? "Your order has been placed successfully. Pay the professional in cash after the service."
                    : "Your service has been booked successfully. Thank you for choosing "}
                  {!isCod && (
                    <span className="font-bold text-[#4338ca]">HomeCareX</span>
                  )}
                  {!isCod && "!"}
                </p>
              </div>
            </div>

            {/* Desktop Confirmed Badge matching reference template */}
            <div className="hidden md:flex shrink-0 self-start md:self-center mt-0.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 border border-emerald-200/90 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                </span>
                {isCod ? "Order Placed" : "Confirmed"}
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. BOOKING DETAILS CARD                                                    */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="booking-details-heading"
          className="rounded-2xl md:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-5 md:py-5 md:px-7 shadow-[0_4px_25px_-5px_rgba(40,30,80,0.05)]"
        >
          {/* ----------------------------------------------------------------------- */}
          {/* DESKTOP 4-COLUMN BALANCED LAYOUT (Edge-to-edge, perfectly proportioned) */}
          {/* ----------------------------------------------------------------------- */}
          <div className="hidden md:grid md:grid-cols-12 md:gap-4 lg:gap-6 items-stretch">
            
            {/* COLUMN 1: SERVICE INFORMATION */}
            <div className="md:col-span-4 border-r border-slate-100 pr-4 lg:pr-6 flex items-start gap-4">
              <BookingThumb
                serviceName={serviceName}
                className="h-20 w-20 lg:h-22 lg:w-22 rounded-2xl shrink-0 shadow-2xs border border-slate-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-md bg-[#ede9fe] text-[#4338ca] px-2.5 py-0.5 text-[11px] font-semibold mb-1">
                  Service
                </span>
                <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                  {serviceName}
                </h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {serviceDescription}
                </p>
              </div>
            </div>

            {/* COLUMN 2: BOOKING DATE & PAYMENT METHOD */}
            <div className="md:col-span-3 border-r border-slate-100 pr-4 lg:pr-6 pl-2 lg:pl-4 flex flex-col justify-between py-0.5 space-y-3">
              {/* Date & Time */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="h-4 w-4 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Booking Date</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-slate-900 truncate">
                  {scheduledDateLong}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{scheduledSlotTime}</span>
                </p>
              </div>

              {/* Payment Method */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CreditCard className="h-4 w-4 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Payment Method</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {paymentMethodLabel}
                </p>
              </div>
            </div>

            {/* COLUMN 3: BOOKING REFERENCE & PAYMENT STATUS */}
            <div className="md:col-span-3 border-r border-slate-100 pr-4 lg:pr-6 pl-2 lg:pl-4 flex flex-col justify-between py-0.5 space-y-3">
              {/* Booking Reference */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Ticket className="h-4 w-4 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Booking Reference</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-slate-900 tracking-wide">
                  {bookingCode}
                </p>
              </div>

              {/* Payment Status */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                  <span>Payment Status</span>
                </div>
                <p className={`mt-0.5 text-sm font-bold ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                  {paymentStatusLabel}
                </p>
              </div>
            </div>

            {/* COLUMN 4: TOTAL AMOUNT PURPLE HIGHLIGHT BOX */}
            <div className="md:col-span-2 flex flex-col justify-between items-center text-center rounded-2xl bg-[#f5f3ff] border border-purple-100/80 p-3.5 lg:p-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Amount
                </p>
                <p className="text-2xl lg:text-3xl font-extrabold text-[#1e1b4b] tracking-tight mt-1">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </p>
              </div>

              <ReceiptBoxGraphic />
            </div>

          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* MOBILE COMPACT BALANCED LAYOUT                                          */}
          {/* ----------------------------------------------------------------------- */}
          <div className="md:hidden space-y-3">
            {/* Header: Title + Confirmed Badge */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-[#4338ca]">
                  <Calendar className="h-3.5 w-3.5 stroke-[2.2]" aria-hidden="true" />
                </div>
                <h2
                  id="booking-details-heading"
                  className="text-sm font-bold text-slate-900 tracking-tight"
                >
                  Booking Details
                </h2>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                {isCod ? "Order Placed" : "Confirmed"}
              </span>
            </div>

            {/* Service row */}
            <div className="flex items-start gap-3">
              <BookingThumb
                serviceName={serviceName}
                className="h-14 w-14 rounded-xl shrink-0 shadow-2xs border border-slate-100"
              />
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#4338ca] mb-0.5">
                  Service
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {serviceName}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                  {serviceDescription}
                </p>
              </div>
            </div>

            {/* 2-Column Info Grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-slate-100">
              {/* Date & Time */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <Calendar className="h-3 w-3 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Date &amp; Time</span>
                </div>
                <p className="text-xs font-bold text-slate-900 truncate leading-tight mt-0.5">
                  {scheduledDateLong}
                </p>
                <p className="text-[11px] text-slate-500 font-medium truncate leading-tight mt-0.5">
                  {scheduledSlotTime}
                </p>
              </div>

              {/* Service Address */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <MapPin className="h-3 w-3 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Service Address</span>
                </div>
                <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug mt-0.5" title={formattedAddress}>
                  {formattedAddress}
                </p>
              </div>

              {/* Payment Method */}
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <CreditCard className="h-3 w-3 text-[#4338ca] shrink-0" aria-hidden="true" />
                  <span>Payment Method</span>
                </div>
                <p className="text-xs font-bold text-slate-900 leading-tight mt-0.5">
                  {paymentMethodLabel}
                </p>
              </div>

              {/* Payment Status */}
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Payment Status</span>
                </div>
                <p className={`text-xs font-bold leading-tight mt-0.5 ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                  {paymentStatusLabel}
                </p>
              </div>
            </div>

            {/* Bottom Highlight Strip */}
            <div className="rounded-xl bg-indigo-50/60 border border-indigo-100/70 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4338ca] text-white">
                  <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-medium text-slate-400 uppercase leading-none">Booking Reference</p>
                  <p className="text-xs font-extrabold text-slate-900 truncate leading-tight mt-0.5">{bookingCode}</p>
                </div>
              </div>

              <div className="h-6 w-px bg-indigo-200/60 mx-2" aria-hidden="true" />

              <div className="text-right shrink-0">
                <p className="text-[9px] font-medium text-slate-400 uppercase leading-none">Total Amount</p>
                <p className="text-sm font-extrabold text-[#4338ca] leading-tight mt-0.5">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. BOOKING PROGRESS TRACKER                                                */}
        {/* ========================================================================= */}
        <section
          aria-label="Booking Progress Tracker"
          className="rounded-2xl md:rounded-3xl border border-slate-100 bg-white p-3.5 sm:p-4 md:py-3.5 md:px-8 shadow-[0_4px_20px_-4px_rgba(40,30,80,0.04)]"
        >
          <div className="flex items-center justify-between">
            {/* Step 1: Booking Confirmed (Done) */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.8]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  {isCod ? "Order Placed" : "Booking Confirmed"}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-none mt-0.5">
                  {bookingPlacedAt}
                </p>
              </div>
            </div>

            {/* Connecting Line */}
            <div className="flex-1 mx-3 sm:mx-6 lg:mx-8">
              <div className="h-1 w-full rounded-full bg-emerald-500" />
            </div>

            {/* Step 2: Service Visit (Upcoming) */}
            <div className="flex items-center gap-2.5 sm:gap-3 text-right sm:text-left">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border-2 border-indigo-200 bg-indigo-50/50 text-[#4338ca]">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.2]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  Service Visit
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-none mt-0.5">
                  {scheduledDateShort ? `${scheduledDateShort} • ` : ""}{scheduledSlotTime}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. ACTION BUTTONS                                                          */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-1">
          {/* Primary: View My Bookings */}
          <Link
            to={customerPath("/bookings")}
            className={`w-full sm:w-auto inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#4338ca] hover:bg-[#3730a3] px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all active:scale-[0.98] ${FOCUS_RING}`}
          >
            <Calendar className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
            <span>View My Bookings</span>
            <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
          </Link>

          {/* Secondary: Return to Home */}
          <Link
            to={customerPath("/")}
            className={`w-full sm:w-auto inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 text-[#4338ca] bg-white hover:bg-indigo-50/60 px-8 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${FOCUS_RING}`}
          >
            <Home className="h-4 w-4 stroke-[2]" aria-hidden="true" />
            <span>Return to Home</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
