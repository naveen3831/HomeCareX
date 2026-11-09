import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Calendar,
  FileText,
  Home,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useBookingDraftStore } from "@/features/booking";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { customerPath } from "@/routes/customerPath";

type Reason = "failed" | "verification" | "network" | "slot" | "cancelled" | "max_retries";

const COPY: Record<
  Reason,
  { title: string; lines: string[]; canRetry: boolean }
> = {
  max_retries: {
    title: "Retry Limit Exceeded",
    lines: [
      "You have reached the maximum of 3 payment retries.",
      "No more payment attempts are allowed for this transaction.",
    ],
    canRetry: false,
  },
  failed: {
    title: "Payment Failed",
    lines: [
      "Your payment could not be completed.",
      "Your booking has not been confirmed. Please try again.",
    ],
    canRetry: true,
  },
  cancelled: {
    title: "Payment Cancelled",
    lines: [
      "You closed the payment window, so you have not been charged.",
      "Your booking is not confirmed yet. You can retry or choose cash on service.",
    ],
    canRetry: true,
  },
  verification: {
    title: "Payment Verification Failed",
    lines: ["Payment verification failed.", "Please contact support or retry."],
    canRetry: true,
  },
  network: {
    title: "We Couldn't Confirm Your Payment",
    lines: [
      "Something went wrong while confirming your payment.",
      "Please check My Bookings / payment status before trying again.",
    ],
    canRetry: false,
  },
  slot: {
    title: "Slot No Longer Available",
    lines: ["This slot is no longer available.", "Please select another slot."],
    canRetry: false,
  },
};

export default function BookingFailed() {
  const { id: bookingId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const serviceSlug = useBookingDraftStore((s) => s.serviceSlug);
  const setStep = useBookingDraftStore((s) => s.setStep);
  const setBookingId = useBookingDraftStore((s) => s.setBookingId);
  const clearDraft = useBookingDraftStore((s) => s.clearDraft);

  const raw = params.get("reason");
  const reason: Reason =
    raw === "verification" ||
    raw === "network" ||
    raw === "slot" ||
    raw === "cancelled" ||
    raw === "max_retries"
      ? raw
      : "failed";
  const copy = COPY[reason];

  const goBack = (step: 3 | 4) => {
    if (!serviceSlug)
      return navigate(customerPath("/services"), { replace: true });
    setStep(step);
    if (bookingId && step === 4) {
      setBookingId?.(bookingId);
    }
    navigate(`${customerPath(`/book/${serviceSlug}`)}?step=${step}`, {
      replace: true,
    });
  };

  const bookingCode = bookingId
    ? bookingId.toUpperCase().startsWith("BK-")
      ? bookingId.toUpperCase()
      : `BK-${bookingId.slice(-5).toUpperCase()}`
    : null;

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 sm:-my-6 md:-mx-8 md:-my-6 min-h-[calc(100vh-112px)] bg-gradient-to-br from-[#eef3fb] via-[#f3f6fc] to-[#e8eefa] flex flex-col items-center justify-start sm:justify-center p-3.5 sm:p-6 lg:p-10 pb-12 sm:pb-12 relative overflow-hidden">
      {/* Ambient background decorative accents */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-purple-100/40 blur-3xl" />

      {/* Centered White Failure Card matching Reference Design */}
      <div className="relative z-10 w-full max-w-[620px] rounded-3xl bg-white p-5 sm:p-8 md:p-10 shadow-[0_12px_40px_-12px_rgba(20,24,60,0.08)] border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Prominent Red Failure Icon with flanking lines */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="h-[1.5px] w-10 sm:w-16 bg-gradient-to-r from-transparent to-red-200/90 rounded-full" />
          <div className="flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100/80 shadow-xs shrink-0">
            <XCircle className="h-7 w-7 sm:h-8 sm:w-8 stroke-[2.2]" aria-hidden="true" />
          </div>
          <div className="h-[1.5px] w-10 sm:w-16 bg-gradient-to-l from-transparent to-red-200/90 rounded-full" />
        </div>

        {/* Dynamic Heading */}
        <h1 className="font-serif text-2xl sm:text-3xl md:text-[34px] font-normal tracking-tight text-slate-900 leading-tight">
          {copy.title}
        </h1>

        {/* Dynamic Error Description */}
        <div
          role="alert"
          className="mt-2.5 sm:mt-3.5 space-y-1 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-md mx-auto"
        >
          {copy.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>

        {/* Dynamic Payment Reference Badge */}
        {bookingCode && (
          <div className="mt-3.5 sm:mt-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 border border-slate-200/70 px-3.5 py-1 text-xs sm:text-[13px] font-medium text-slate-600">
              <span>Reference:</span>
              <span className="font-semibold text-slate-900">{bookingCode}</span>
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="my-5 sm:my-7 border-t border-slate-100" />

        {/* Next Steps Section */}
        <div className="text-left">
          <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 mb-3">
            Next Steps
          </h2>

          <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-7">
            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#4338ca] border border-purple-100/80 shadow-2xs">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-[#4338ca]" strokeWidth={1.8} aria-hidden="true" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#4338ca] text-white ring-2 ring-white">
                <RotateCw className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-0.5 sm:pt-1">
              {reason === "max_retries"
                ? "You have reached the maximum of 3 failed payment attempts. For security reasons, this booking cannot be retried. Please create a new booking or view your existing requests."
                : "You can try completing your payment again or view your existing requests in My Bookings."}
            </p>
          </div>

          {/* Three Action Buttons: Full-width comfortable height on Mobile, Horizontal on Desktop */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5">
            {copy.canRetry && (
              <button
                type="button"
                onClick={() => goBack(4)}
                className={`w-full sm:flex-1 h-12 min-h-[48px] shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4338ca] hover:bg-[#3730a3] active:bg-[#312e81] text-white text-sm sm:text-[15px] font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer ${FOCUS_RING}`}
              >
                <RotateCw className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
                <span>Retry Payment</span>
              </button>
            )}

            {reason === "max_retries" && (
              <Link
                to={customerPath("/services")}
                onClick={() => clearDraft()}
                className={`w-full sm:flex-1 h-12 min-h-[48px] shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4338ca] hover:bg-[#3730a3] active:bg-[#312e81] text-white text-sm sm:text-[15px] font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer ${FOCUS_RING}`}
              >
                <span>Start a New Booking</span>
              </Link>
            )}

            {reason === "slot" && (
              <button
                type="button"
                onClick={() => goBack(3)}
                className={`w-full sm:flex-1 h-12 min-h-[48px] shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4338ca] hover:bg-[#3730a3] active:bg-[#312e81] text-white text-sm sm:text-[15px] font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer ${FOCUS_RING}`}
              >
                <RotateCw className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
                <span>Choose another slot</span>
              </button>
            )}

            <Link
              to={customerPath("/bookings")}
              className={`w-full sm:flex-1 h-12 min-h-[48px] shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#4338ca] bg-white text-[#4338ca] hover:bg-indigo-50/70 active:bg-indigo-100/60 text-sm sm:text-[15px] font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer ${FOCUS_RING}`}
            >
              <Calendar className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
              <span>View My Bookings</span>
            </Link>

            <Link
              to={customerPath("/")}
              className={`w-full sm:flex-1 h-12 min-h-[48px] shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-sm sm:text-[15px] font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer ${FOCUS_RING}`}
            >
              <Home className="h-4 w-4 stroke-[2] text-slate-500" aria-hidden="true" />
              <span>Return to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
