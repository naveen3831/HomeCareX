import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  CircleAlert,
  Clock,
  Compass,
  CreditCard,
  Headset,
  Layers,
  MapPin,
  Navigation,
  RotateCcw,
  Wallet,
  Trash2,
  Users,
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
import { useBooking, useDecideExtraCharge } from "@/hooks/useBooking";
import { customerPath } from "@/routes/customerPath";
import type { BookingDetailView } from "@/types/bookingDetail";
import { PILL_CLASS, formatSlot, rupees } from "../Bookings/bookingModel";
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
import InvoiceCard from "./components/InvoiceCard";
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
      className="space-y-4"
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
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3.5 py-4 outline-none sm:px-6 sm:py-6">
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
  const [imgFailed, setImgFailed] = useState(false);
  const [dialog, setDialog] = useState<"cancel" | "reschedule" | null>(null);

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

  return (
    <>
      {/* Top back button */}
      <div className="mb-3">
        <Link
          to={customerPath("/bookings")}
          className={clsx(
            "inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink",
            FOCUS_RING,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to My Bookings</span>
        </Link>
      </div>

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
          <p className="mt-1 text-xs text-muted">
            Booking ID: <span className="font-semibold text-ink">{code}</span>
            {bookedOn && (
              <>
                <span className="mx-2 text-line">•</span>
                <span>Booked on {bookedOn}</span>
              </>
            )}
          </p>
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
              partner={
                booking.partner ||
                (typeof booking.partnerId === "object" && booking.partnerId !== null
                  ? booking.partnerId
                  : null)
              }
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
