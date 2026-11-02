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

import BookingThumb from "@/pages/customer/Dashboard/sections/BookingThumb";
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

const TRACKABLE = new Set([
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
]);

type DecideMutation = ReturnType<typeof useDecideExtraCharge>;

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

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
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

function serviceNameOf(booking: BookingDetailView): string {
  return (
    booking.priceSnapshot?.lines?.find((line) => line.kind === "BASE")
      ?.name ||
    booking.serviceName ||
    "Home Service"
  );
}

export default function BookingDetails() {
  const { id } = useParams<{ id: string }>();
  const online = useOnlineStatus();
  const query = useBooking(id);
  const decide = useDecideExtraCharge(id ?? "");

  // CustomerLayout already provides the main page spacing.
  const shell = (children: ReactNode) => (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3.5 py-4 outline-none sm:px-6 sm:py-6">
      {children}
    </div>
  );

  if (!id) {
    return shell(<NotFound />);
  }

  if (query.isPending) {
    return shell(<DetailsSkeleton />);
  }

  if (query.isError && !query.data) {
    const { status, code, message } = query.error;

    // Keep missing bookings and malformed IDs indistinguishable.
    if (status === 404 || status === 400) {
      return shell(<NotFound />);
    }

    if (!online || status === 0 || code === "NETWORK_ERROR") {
      return shell(
        <OfflineState onRetry={() => void query.refetch()} />,
      );
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

  if (!booking) {
    return shell(<LoadingState label="Loading your booking…" />);
  }

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
  const [dialog, setDialog] = useState<"cancel" | "reschedule" | null>(
    null,
  );

  const bookingId = String(
    booking._id || (booking as { id?: string }).id || "",
  );

  const normalizedStatus = String(booking.status || "").toLowerCase();
  const pill = statusPill(booking);

  const code =
    booking.bookingNumber ||
    (bookingId
      ? `BK-${bookingId.slice(-5).toUpperCase()}`
      : "BK-BOOKING");

  const name = serviceNameOf(booking);
  const timeline = buildTimeline(booking);
  const price = buildPriceBreakdown(booking);
  const payment = paymentSummary(booking);

  const pay = booking.paymentDetails;
  const address = booking.addressSnapshot;

  const cancelled = isCancelledBooking(booking);
  const finished =
    normalizedStatus === "completed" || normalizedStatus === "rated";

  const active =
    !finished && !cancelled && normalizedStatus !== "disputed";

  // The backend remains the final authority for state changes.
  const canCancel = active && canCancelBooking(booking.status);

  const canReschedule =
    active &&
    canRescheduleBooking(booking.status) &&
    Boolean(booking.serviceId && booking.date && booking.slot);

  const showOtp =
    Boolean(booking.partnerId) &&
    (normalizedStatus === "arrived" || Boolean(booking.startOtp));

  const hasPendingExtraCharges = (booking.extraCharges ?? []).some(
    (charge) => String(charge.status).toLowerCase() === "pending",
  );

  const isPaid =
    String(booking.paymentStatus || "").toUpperCase() === "PAID";

  const refund = booking.refund;
  const refundPill = refundBadge(refund, booking.refundStatus);

  const showRefundCard =
    cancelled &&
    Boolean(refund) &&
    refund?.status !== "NOT_REQUIRED";

  const addOnLines = (booking.priceSnapshot?.lines ?? []).filter(
    (line) => line.kind === "ADDON",
  );

  const service = booking.service;
  const day = weekdayOf(booking.date);
  const dateFormatted = booking.date
    ? formatPlainDate(booking.date)
    : "Not scheduled";
  const slotFormatted = booking.slot ? formatSlot(booking.slot) : "Not scheduled";
  const bookedOn = formatBookedOn(booking.createdAt);

  const duration = formatDuration(
    service?.durationMinutes ||
      (booking as { durationMinutes?: number }).durationMinutes,
  );

  const maps = mapsUrl(address);
  const paidOn = formatMoment(pay?.paidAt);
  const methodText = paymentMethodLabel(pay?.method);
  const txn = pay?.transactionId || pay?.paymentId;

  const supportHref = `${customerPath("/support")}?booking=${encodeURIComponent(
    bookingId,
  )}`;

  const scheduledAt = (
    booking as { scheduledAt?: string | Date }
  ).scheduledAt;

  // Some bookings store a start time without a time range.
  const slotHours = (() => {
    const match =
      /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/.exec(
        booking.slot || "",
      );

    if (!match) {
      return "";
    }

    const [startH, startM, endH, endM] = [
      match[1],
      match[2],
      match[3],
      match[4],
    ].map(Number);

    const minutes =
      endH * 60 + endM - (startH * 60 + startM);

    return minutes > 0 ? formatDuration(minutes) : "";
  })();

  return (
    <>
      {/* Back navigation */}
      <div className="mb-4">
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

      {/* Booking header */}
      <header className="mb-5 rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04)] sm:mb-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
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

            <h1 className="mt-2 break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {name}
            </h1>

            <p className="mt-1 text-xs text-muted">
              Booking ID:{" "}
              <span className="font-semibold text-ink">{code}</span>

              {bookedOn && (
                <>
                  <span className="mx-2 text-line">•</span>
                  <span>Booked on {bookedOn}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </header>

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
                Review and approve or reject the additional on-site items
                requested by your service partner.
              </p>
            </div>
          </div>

          <a
            href="#extra-charges-heading"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            Review Charges
          </a>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <Section
            id="timeline-heading"
            title="Booking Status"
            icon={Activity}
          >
            <StatusTimeline items={timeline} />
          </Section>

          {showRefundCard && refund && (
            <Section
              id="refund-details-heading"
              title="Refund Details"
              icon={RotateCcw}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      refundPill
                        ? PILL_CLASS[refundPill.tone]
                        : "bg-muted/10 text-muted",
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

                  {typeof refund.amount === "number" &&
                    refund.amount > 0 && (
                      <span className="text-base font-bold text-ink">
                        {rupees(refund.amount)}
                      </span>
                    )}
                </div>

                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 sm:text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted">Refund Destination</dt>
                    <dd className="flex items-center gap-1.5 font-semibold text-ink">
                      <Wallet className="h-4 w-4 text-brand" />
                      {refund.destination || "HomeCareX Wallet"}
                    </dd>
                  </div>

                  {refund.originalPaidAmount !== undefined &&
                    refund.originalPaidAmount > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted">
                          Original Amount Paid
                        </dt>
                        <dd className="font-semibold text-ink">
                          {rupees(refund.originalPaidAmount)}
                        </dd>
                      </div>
                    )}

                  {refund.requestedAt && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted">Request Date</dt>
                      <dd className="font-semibold text-ink">
                        {formatMoment(refund.requestedAt)}
                      </dd>
                    </div>
                  )}

                  {refund.status === "CREDITED" && refund.creditedAt && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted">Credited Date</dt>
                      <dd className="font-semibold text-green-700">
                        {formatMoment(refund.creditedAt)}
                      </dd>
                    </div>
                  )}

                  {refund.status === "CREDITED" &&
                    refund.walletTransactionRef && (
                      <div className="flex flex-col gap-0.5 sm:col-span-2">
                        <dt className="text-muted">
                          Wallet Transaction Reference
                        </dt>
                        <dd className="break-all rounded-md border border-line bg-canvas px-2.5 py-1 font-mono text-xs font-bold text-ink">
                          {refund.walletTransactionRef}
                        </dd>
                      </div>
                    )}

                  {refund.status === "REJECTED" && (
                    <div className="flex flex-col gap-0.5 rounded-xl border border-danger/20 bg-danger-soft/60 p-3 sm:col-span-2">
                      <dt className="font-semibold text-danger">
                        Rejection Reason
                      </dt>
                      <dd className="mt-0.5 text-xs text-ink">
                        {refund.rejectionReason ||
                          "No explicit reason was provided."}
                      </dd>

                      {refund.rejectedAt && (
                        <p className="mt-1.5 text-[11px] text-muted">
                          Decision date: {formatMoment(refund.rejectedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </dl>

                {refund.status === "CREDITED" && (
                  <Link
                    to={customerPath("/wallet")}
                    className={clsx(
                      LINK_BUTTON,
                      "w-full bg-brand text-white shadow-sm hover:opacity-90",
                      FOCUS_RING,
                    )}
                  >
                    <Wallet className="h-4 w-4" />
                    <span>View in Wallet</span>
                  </Link>
                )}

                {refund.status === "REJECTED" && (
                  <Link
                    to={supportHref}
                    className={clsx(
                      LINK_BUTTON,
                      "w-full border border-line bg-canvas text-ink hover:bg-panel",
                      FOCUS_RING,
                    )}
                  >
                    <Headset className="h-4 w-4 text-brand" />
                    <span>Contact Support / Appeal</span>
                  </Link>
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

          <Section
            id="service-heading"
            title="Service Details"
            icon={Wrench}
          >
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
                  <h3 className="break-words text-base font-bold text-ink">
                    {name}
                  </h3>

                  {booking.quantity > 1 && (
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      × {booking.quantity}
                    </span>
                  )}
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
                      <Layers className="h-3.5 w-3.5" />
                      {service.categoryName}
                    </span>
                  )}

                  {booking.quantity > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
                      Qty: {booking.quantity}
                    </span>
                  )}
                </div>

                {addOnLines.length > 0 && (
                  <p className="mt-2 break-words text-sm text-muted">
                    <span className="font-medium text-ink">Add-ons: </span>
                    {addOnLines
                      .map(
                        (line) =>
                          `${line.name}${
                            line.quantity > 1 ? ` × ${line.quantity}` : ""
                          }`,
                      )
                      .join(", ")}
                  </p>
                )}
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
                      className="flex items-center justify-between gap-3 py-2 text-xs"
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

                      <span className="shrink-0 font-semibold text-ink">
                        {rupees(addon.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section
            id="partner-heading"
            title="Service Partner"
            icon={Users}
          >
            <PartnerCard
              partner={
                booking.partner ||
                (typeof booking.partnerId === "object" &&
                booking.partnerId !== null
                  ? (booking.partnerId as unknown as typeof booking.partner)
                  : null)
              }
              hasPartner={Boolean(booking.partnerId)}
              isCancelled={cancelled}
            />
          </Section>

          <Section
            id="schedule-heading"
            title="Schedule"
            icon={CalendarDays}
          >
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

          <Section
            id="address-heading"
            title="Service Address"
            icon={MapPin}
          >
            {address ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <address className="min-w-0 break-words text-sm not-italic text-ink">
                  {address.label && (
                    <span className="mb-0.5 block font-semibold">
                      {address.label}
                    </span>
                  )}

                  {[address.line1, address.line2, address.landmark]
                    .filter(Boolean)
                    .join(", ")}

                  <br />

                  {[address.city, address.state]
                    .filter(Boolean)
                    .join(", ")}

                  {address.pincode ? ` - ${address.pincode}` : ""}

                  {address.contactName && (
                    <span className="mt-1 block text-muted">
                      {address.contactName}
                      {address.contactPhone
                        ? ` · ${address.contactPhone}`
                        : ""}
                    </span>
                  )}
                </address>

                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      LINK_BUTTON,
                      "self-start border border-line bg-canvas text-xs text-ink shadow-2xs hover:bg-panel",
                      FOCUS_RING,
                    )}
                  >
                    <Navigation
                      className="h-4 w-4 text-brand"
                      aria-hidden="true"
                    />
                    <span>View on Maps</span>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Address details unavailable for this booking.
              </p>
            )}
          </Section>

          {/* Start OTP */}
          {showOtp && <OtpDisplay code={booking.startOtp} />}
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:sticky lg:top-6">
          <Section
            id="price-heading"
            title="Price Breakdown"
            icon={Layers}
          >
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

              {methodText && (
                <Row label="Payment Method">{methodText}</Row>
              )}

              {txn && (
                <Row label="Transaction ID">
                  <span className="font-mono text-xs">{txn}</span>
                </Row>
              )}

              {paidOn && payment.label === "Paid" && (
                <Row label="Paid On">{paidOn}</Row>
              )}
            </dl>
          </Section>

          <Section
            id="actions-heading"
            title="Booking Actions"
            icon={Zap}
          >
            <div className="flex flex-col gap-2.5">
              {showRefundCard && refund && (
                <div className="space-y-2.5 rounded-xl border border-line bg-canvas/70 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Refund Status
                    </span>

                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        refundPill
                          ? PILL_CLASS[refundPill.tone]
                          : "bg-muted/10 text-muted",
                      )}
                    >
                      {refundPill?.dot && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      )}
                      {refund.statusLabel || refundPill?.label || "Refund"}
                    </span>
                  </div>

                  {typeof refund.amount === "number" &&
                    refund.amount > 0 && (
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted">
                          {refund.status === "CREDITED"
                            ? "Credited Amount"
                            : "Refund Amount"}
                        </span>
                        <span className="font-bold text-ink">
                          {rupees(refund.amount)}
                        </span>
                      </div>
                    )}

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">Destination</span>
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Wallet className="h-3.5 w-3.5 text-brand" />
                      {refund.destination || "HomeCareX Wallet"}
                    </span>
                  </div>

                  {refund.status === "CREDITED" &&
                    refund.walletTransactionRef && (
                      <div className="break-all text-[11px] text-muted">
                        <span>Ref: </span>
                        <span className="font-mono font-medium text-ink">
                          {refund.walletTransactionRef}
                        </span>
                      </div>
                    )}

                  {refund.status === "CREDITED" && (
                    <Link
                      to={customerPath("/wallet")}
                      className={clsx(
                        LINK_BUTTON,
                        "mt-1 w-full bg-brand text-white hover:opacity-90",
                        FOCUS_RING,
                      )}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Check Wallet Balance</span>
                    </Link>
                  )}

                  {refund.status === "REJECTED" && (
                    <div className="mt-1 border-t border-line pt-1.5 text-[11px]">
                      <p className="font-medium text-danger">
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
                  to={customerPath(
                    `/bookings/${encodeURIComponent(bookingId)}/track`,
                  )}
                  className={clsx(
                    LINK_BUTTON,
                    "border border-brand/30 bg-panel text-brand hover:border-brand hover:bg-brand-soft hover:text-ink",
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
                  <CalendarClock
                    className="h-4 w-4 text-muted"
                    aria-hidden="true"
                  />
                  <span>Reschedule Booking</span>
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
                  <span>Cancel Booking</span>
                </button>
              )}

              {!cancelled && (
                <RateExperience
                  bookingId={bookingId}
                  status={booking.status}
                />
              )}

              <BookAgainButton booking={booking} />
            </div>
          </Section>

          <section className="rounded-2xl border border-line/80 bg-panel p-5 shadow-[0_2px_8px_rgba(30,27,46,0.03)] sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Headset
                className="h-5 w-5 text-brand"
                aria-hidden="true"
              />
              Need Help?
            </h2>

            <p className="mt-2 text-sm text-muted">
              Contact our support team for any assistance regarding this
              booking.
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

      {/* Booking dialogs */}
      {dialog === "cancel" && (
        <CancelDialog
          bookingId={bookingId}
          onClose={() => setDialog(null)}
        />
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
          className={clsx(
            LINK_BUTTON,
            "bg-brand text-white",
            FOCUS_RING,
          )}
        >
          Back to my bookings
        </Link>
      }
    />
  );
}