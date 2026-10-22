import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  Clock,
  CreditCard,
  Headset,
  Layers,
  MapPin,
  Navigation,
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
import { PILL_CLASS, formatSlot } from "../Bookings/bookingModel";
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
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:opacity-90";

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
        "min-w-0 rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04)] sm:p-6",
        className,
      )}
    >
      <h2
        id={id}
        className="mb-5 flex items-center gap-2.5 text-[15px] font-bold text-ink"
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
    <div className="flex items-center justify-between gap-3 text-sm">
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
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-canvas p-3.5 ring-1 ring-line">
      <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="break-words text-sm font-semibold text-ink">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
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
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

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
    <main
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl min-w-0 px-3.5 py-4 outline-none sm:px-6 sm:py-8"
    >
      {children}
    </main>
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

type DecideMutation = ReturnType<typeof useDecideExtraCharge>;

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

  const pill = statusPill(booking);
  const code =
    booking.bookingNumber || `BK-${booking._id.slice(-5).toUpperCase()}`;
  const name = serviceNameOf(booking);
  const timeline = buildTimeline(booking);
  const price = buildPriceBreakdown(booking);
  const payment = paymentSummary(booking);
  const pay = booking.paymentDetails;
  const address = booking.addressSnapshot;
  const cancelled = isCancelledBooking(booking);
  const finished = booking.status === "completed" || booking.status === "rated";
  const active = !finished && !cancelled && booking.status !== "disputed";
  // Same guards as the server's state machine; the server still has the final say.
  const canCancel = active && canCancelBooking(booking.status);
  const canReschedule =
    active &&
    canRescheduleBooking(booking.status) &&
    Boolean(booking.serviceId && booking.date && booking.slot);
  const showOtp =
    Boolean(booking.partnerId) && (active || Boolean(booking.startOtp));
  const isPaid = booking.paymentStatus === "PAID";
  const addOnLines = (booking.priceSnapshot?.lines ?? []).filter(
    (l) => l.kind === "ADDON",
  );
  const service = booking.service;
  const duration = formatDuration(service?.durationMinutes);
  const bookedOn = formatBookedOn(booking.createdAt);
  const weekday = weekdayOf(booking.date);
  // Seeded / partner-side bookings can carry a bare start time ("10:00") instead of "10:00-12:00".
  // Never let a formatting helper take the whole page down.
  const slotText = (() => {
    try {
      return booking.slot ? formatSlot(booking.slot) : "";
    } catch {
      return booking.slot || "";
    }
  })();
  const map = mapsUrl(address);
  const paidOn = formatMoment(pay?.paidAt);
  const methodText = paymentMethodLabel(pay?.method);
  const txn = pay?.transactionId || pay?.paymentId;
  const supportHref = `${customerPath("/support")}?booking=${encodeURIComponent(booking._id)}`;
  const slotHours = (() => {
    const m = /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/.exec(
      booking.slot || "",
    );
    if (!m) return "";
    return formatDuration(+m[3] * 60 + +m[4] - (+m[1] * 60 + +m[2]))
      .replace("Hours", "hours")
      .replace("Hour", "hour");
  })();

  return (
    <>
      {/* Back link and header sit above both columns. */}
      <Link
        to={customerPath("/bookings")}
        className={clsx(
          "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline",
          FOCUS_RING,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to My Bookings
      </Link>

      {/* Header spans both columns, so Booking Status and Price Breakdown below start on the same line. */}
      <header className="mb-5 sm:mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[32px]">
            Booking Details
          </h1>
          <span
            className={clsx(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold",
              PILL_CLASS[pill.tone],
            )}
          >
            {pill.dot ? (
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-current"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded-full bg-current"
              >
                <svg
                  viewBox="0 0 12 12"
                  className="h-2.5 w-2.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2.5 6.5l2.2 2.2L9.5 3.8" />
                </svg>
              </span>
            )}
            {pill.label}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          Booking ID: {code}
          {bookedOn && <span className="mx-2">•</span>}
          {bookedOn && <>Booked on {bookedOn}</>}
        </p>
      </header>

      {refetchFailed && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {online
            ? "We couldn't refresh this booking just now. Showing the last version we have."
            : "You're offline. Showing the last version we have."}
        </p>
      )}

      {cancelled && booking.cancellationReason && (
        <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          Reason: {booking.cancellationReason}
        </p>
      )}

      {/* Row one: Booking Status and Price Breakdown share the same top edge. */}
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <Section id="timeline-heading" title="Booking Status" icon={Activity}>
            <StatusTimeline items={timeline} />
          </Section>

          <Section id="service-heading" title="Service Details" icon={Wrench}>
            <div className="flex flex-col gap-4 sm:flex-row">
              {service?.image && !imgFailed ? (
                <img
                  src={service.image}
                  alt=""
                  loading="lazy"
                  onError={() => setImgFailed(true)}
                  className="h-28 w-full shrink-0 rounded-xl border border-line object-cover sm:w-40"
                />
              ) : (
                <BookingThumb
                  serviceName={name}
                  className="h-28 w-full shrink-0 rounded-xl border border-line sm:w-40"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-lg font-bold text-ink">
                    {name}
                  </h3>
                  {booking.quantity > 1 && (
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      × {booking.quantity}
                    </span>
                  )}
                </div>
                {service?.description && (
                  <p className="mt-1 text-sm text-muted">
                    {service.description}
                  </p>
                )}
                {(duration || service?.categoryName) && (
                  <ul className="mt-3 flex flex-wrap items-center gap-y-2 text-sm text-muted [&>li+li]:ml-4 [&>li+li]:border-l [&>li+li]:border-line [&>li+li]:pl-4">
                    {duration && (
                      <li className="flex items-center gap-1.5">
                        <Clock
                          className="h-4 w-4 text-brand"
                          aria-hidden="true"
                        />
                        {duration}
                      </li>
                    )}
                    {service?.categoryName && (
                      <li className="flex items-center gap-1.5">
                        <Layers
                          className="h-4 w-4 text-brand"
                          aria-hidden="true"
                        />
                        {service.categoryName}
                      </li>
                    )}
                  </ul>
                )}
                {addOnLines.length > 0 && (
                  <p className="mt-2 break-words text-sm text-muted">
                    <span className="font-medium text-ink">Add-ons: </span>
                    {addOnLines
                      .map(
                        (l) =>
                          `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ""}`,
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section id="partner-heading" title="Service Partner" icon={Users}>
            <PartnerCard
              partner={booking.partner}
              hasPartner={Boolean(booking.partnerId)}
              isCancelled={cancelled}
            />
          </Section>

          <Section id="schedule-heading" title="Schedule" icon={CalendarDays}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile
                icon={CalendarDays}
                label="Service Date"
                value={
                  booking.date ? formatPlainDate(booking.date) : "Not scheduled"
                }
                hint={weekday ? `(${weekday})` : undefined}
              />
              <Tile
                icon={Clock}
                label="Time Slot"
                value={slotText || "To be confirmed"}
                hint={slotHours ? `(${slotHours})` : undefined}
              />
            </div>
          </Section>

          <Section id="address-heading" title="Service Address" icon={MapPin}>
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
                  {[address.city, address.state].filter(Boolean).join(", ")}
                  {address.pincode ? ` - ${address.pincode}` : ""}
                  {address.contactName && (
                    <span className="mt-1 block text-muted">
                      {address.contactName}
                      {address.contactPhone ? ` · ${address.contactPhone}` : ""}
                    </span>
                  )}
                </address>
                {map && (
                  <a
                    href={map}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "inline-flex h-10 items-center gap-2 rounded-xl border border-brand/30 px-4 text-sm font-semibold text-brand transition hover:bg-brand-soft",
                      FOCUS_RING,
                    )}
                  >
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    View on Maps
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">No address on this booking.</p>
            )}
          </Section>

          {Boolean(booking.extraCharges?.length) && (
            <ExtraChargeApproval
              charges={booking.extraCharges}
              canDecide={canDecideExtraCharges(booking.status)}
              onDecide={(chargeId, decision) =>
                decide.mutateAsync({ chargeId, decision })
              }
            />
          )}

          {/* Start OTP: bottom of the left column, as in the design */}
          {showOtp && <OtpDisplay code={booking.startOtp} />}
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
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
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    PILL_CLASS[payment.tone],
                  )}
                >
                  {payment.label}
                </span>
              </Row>
              {methodText && <Row label="Payment Method">{methodText}</Row>}
              {txn && <Row label="Transaction ID">{txn}</Row>}
              {paidOn && payment.label === "Paid" && (
                <Row label="Paid On">{paidOn}</Row>
              )}
            </dl>
          </Section>

          <Section id="actions-heading" title="Booking Actions" icon={Zap}>
            <div className="flex flex-col gap-2.5">
              <InvoiceCard
                bookingId={booking._id}
                bookingCode={code}
                enabled={isPaid}
                isCancelled={cancelled}
              />
              {TRACKABLE.has(booking.status) && (
                <Link
                  to={customerPath(`/bookings/${encodeURIComponent(booking._id)}/track`)}
                  className={clsx(
                    LINK_BUTTON,
                    "border border-brand/30 bg-panel text-brand",
                    FOCUS_RING,
                  )}
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Live Tracking
                </Link>
              )}
              {canReschedule && (
                <button
                  type="button"
                  onClick={() => setDialog("reschedule")}
                  className={clsx(
                    LINK_BUTTON,
                    "border border-brand/30 bg-panel text-brand",
                    FOCUS_RING,
                  )}
                >
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  Reschedule Booking
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setDialog("cancel")}
                  className={clsx(
                    LINK_BUTTON,
                    "border border-danger/40 bg-panel text-danger",
                    FOCUS_RING,
                  )}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Cancel Booking
                </button>
              )}
              {!cancelled && <RateExperience bookingId={booking._id} status={booking.status} />}
              <BookAgainButton booking={booking} />
            </div>
          </Section>

          <section className="rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04)] sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Headset className="h-5 w-5 text-brand" aria-hidden="true" />
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
                "mt-3 w-full border border-brand/30 bg-panel text-brand",
                FOCUS_RING,
              )}
            >
              Contact Support
            </Link>
          </section>
        </div>
      </div>

      {dialog === "cancel" && (
        <CancelDialog bookingId={booking._id} onClose={() => setDialog(null)} />
      )}
      {dialog === "reschedule" && (
        <RescheduleDialog
          bookingId={booking._id}
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