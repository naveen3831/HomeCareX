import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
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

  // No top padding: CustomerLayout's <main> already spaces the page from the top bar.
  const shell = (children: ReactNode) => (
    <main
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl min-w-0 px-3.5 pb-4 outline-none sm:px-6 sm:pb-8"
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

  const bookingId = String(booking._id || (booking as any).id || "");
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
  const addOnLines = (booking.priceSnapshot?.lines ?? []).filter(
    (l) => l.kind === "ADDON",
  );
  const service = booking.service;
  const day = weekdayOf(booking.date);
  const dateFormatted = formatPlainDate(booking.date);
  const slotFormatted = formatSlot(booking.slot);
  const bookedOn = formatBookedOn(booking.createdAt);
  const duration = formatDuration(service?.durationMinutes || (booking as any).durationMinutes);
  const maps = mapsUrl(address);
  const paidOn = formatMoment(pay?.paidAt);
  const methodText = paymentMethodLabel(pay?.method);
  const txn = pay?.transactionId || pay?.paymentId;
  const supportHref = `${customerPath("/support")}?booking=${encodeURIComponent(bookingId)}`;
  const scheduledAt = (booking as any).scheduledAt;
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
      {/* Back link and header sit above both columns.
      <Link
        to={customerPath("/bookings")}
        className={clsx(
          "mb-4 inline-flex max-md:hidden items-center gap-1.5 text-sm font-medium text-brand hover:underline",
          FOCUS_RING,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to My Bookings
      </Link> */}

      {/* Header spans both columns, so Booking Status and Price Breakdown below start on the same line. */}
      <header className="mb-5 sm:mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="sr-only">Booking Details</h1>
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
      {/* Top back button */}
      <div className="mb-4">
        <Link
          to={customerPath("/bookings")}
          className={clsx(
            "inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink",
            FOCUS_RING,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to all bookings</span>
        </Link>
      </div>

      {/* Header card */}
      <div className="mb-4 rounded-2xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(30,27,46,0.04)] sm:mb-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
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
            <h1 className="mt-2 truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {name}
            </h1>
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
          className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:flex-row sm:items-center sm:justify-between"
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

      {/* Row one: Booking Status and Price Breakdown share the same top edge. */}
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <Section id="status-heading" title="Booking Status" icon={Activity}>
            <StatusTimeline items={timeline} />
          </Section>

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
                  {service?.categoryName && (
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                      {service.categoryName}
                    </span>
                  )}
                </div>
                {service?.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {service.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  <span>
                    Qty:{" "}
                    <strong className="text-ink">
                      {booking.quantity || 1}
                    </strong>
                  </span>
                  {duration && (
                    <span>
                      Duration: <strong className="text-ink">{duration}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {addOnLines.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
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
                  ? (booking.partnerId as any)
                  : null)
              }
              hasPartner={Boolean(booking.partnerId)}
              isCancelled={cancelled}
            />
          </Section>

          <Section id="address-heading" title="Service Address" icon={MapPin}>
            {address ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Delivery address
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
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
                      "self-start border border-line bg-canvas text-xs text-ink hover:bg-panel",
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

          <Section
            id="slot-heading"
            title="Scheduled Date & Time"
            icon={CalendarDays}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile
                icon={CalendarDays}
                label="Date"
                value={dateFormatted}
                hint={day}
              />
              <Tile
                icon={Clock}
                label="Time Slot"
                value={slotFormatted}
                hint={slotHours ? `Approx. ${slotHours}` : undefined}
              />
            </div>
            {scheduledAt && (
              <p className="mt-3 text-xs text-muted">
                Scheduled instant: {formatMoment(scheduledAt)}
              </p>
            )}
          </Section>

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
            <dl className="space-y-2.5">
              <Row label="Status">
                <span
                  className={clsx(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                    PILL_CLASS[payment.tone],
                  )}
                >
                  {payment.label}
                </span>
              </Row>
              {methodText && <Row label="Method">{methodText}</Row>}
              {txn && (
                <Row label="Transaction ID">
                  <span className="font-mono text-xs">{txn}</span>
                </Row>
              )}
              {paidOn && <Row label="Paid on">{paidOn}</Row>}
            </dl>
          </Section>

          <Section id="actions-heading" title="Booking Actions" icon={Zap}>
            <div className="flex flex-col gap-2.5">
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
                    "border border-brand/30 bg-panel text-brand",
                    "hover:border-brand hover:bg-brand-soft hover:text-ink",
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
              {!cancelled && <RateExperience bookingId={bookingId} status={booking.status} />}
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
