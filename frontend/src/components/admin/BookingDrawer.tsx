import React, { useEffect, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSidebarOffset } from "@/hooks/useSidebarOffset";

import type {
  AdminBooking,
  BookingStatus,
  TimelineActorType,
} from "@/types/adminBooking";

import { BookingActionPanel } from "@/components/admin/BookingActionPanel";
import { NotificationBell } from "@/components/admin/NotificationBell";

import type { TimelineItem } from "@/components/admin/Timeline";

interface BookingDrawerProps {
  booking: AdminBooking | null;
  open: boolean;
  onClose: () => void;

  onAssignPartner?: (booking: AdminBooking) => void;
  onStatusOverride?: (booking: AdminBooking) => void;
  /** When provided, the cancel screen is controlled by the URL. */
  cancelOpen?: boolean;
  onCancelOpen?: () => void;
  onCancelClose?: () => void;

  onCancelBooking?: (
    booking: AdminBooking,
    reason: string,
  ) => void | Promise<void>;
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "pending_payment" -> "Pending payment" for statuses the backend sends that are not in the union. */
function prettifyStatus(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "created":
      return "Pending";

    case "searching_for_partner":
      return "Searching for Partner";

    case "assigned":
      return "Assigned";

    case "en_route":
      return "En Route";

    case "arrived":
      return "Arrived";

    case "in_progress":
      return "In Progress";

    case "completed":
      return "Completed";

    case "rated":
      return "Rated";

    case "cancelled_by_customer":
      return "Cancelled by Customer";

    case "cancelled_by_partner":
      return "Cancelled by Partner";

    case "cancelled_by_admin":
      return "Cancelled by Admin";

    case "no_show":
      return "No Show";

    case "disputed":
      return "Disputed";

    default:
      return prettifyStatus(String(status));
  }
}

function getStatusClass(status: BookingStatus): string {
  // "confirmed" is sent by the backend after payment but is not part of the BookingStatus union.
  if (String(status) === "confirmed") {
    return "booking-details__status booking-details__status--confirmed";
  }
  switch (status) {
    case "completed":
    case "rated":
      return "booking-details__status booking-details__status--completed";

    case "cancelled_by_customer":
    case "cancelled_by_partner":
    case "cancelled_by_admin":
    case "no_show":
      return "booking-details__status booking-details__status--cancelled";

    case "in_progress":
    case "en_route":
    case "arrived":
      return "booking-details__status booking-details__status--progress";

    case "assigned":
      return "booking-details__status booking-details__status--assigned";

    case "searching_for_partner":
      return "booking-details__status booking-details__status--confirmed";

    case "disputed":
      return "booking-details__status booking-details__status--cancelled";

    case "created":
    default:
      return "booking-details__status booking-details__status--pending";
  }
}

function getPaymentClass(status: string): string {
  switch (status) {
    case "Paid":
      return "booking-details__status booking-details__status--paid";

    case "Failed":
      return "booking-details__status booking-details__status--failed";

    case "Refunded":
      return "booking-details__status booking-details__status--refunded";

    case "Pending":
    default:
      return "booking-details__status booking-details__status--payment-pending";
  }
}

function getActorLabel(actorType: TimelineActorType): string {
  switch (actorType) {
    case "Admin":
      return "Admin";

    case "Customer":
      return "Customer";

    case "Partner":
      return "Partner";

    case "System":
      return "System";

    default:
      return actorType;
  }
}

function buildTimelineItems(
  booking: AdminBooking,
): TimelineItem[] {
  if (!Array.isArray(booking.timeline)) {
    return [];
  }

  return booking.timeline.map((item) => ({
    id: item.id,
    title: getStatusLabel(item.status),
    description: (
      <>
        {item.note && <span>{item.note}</span>}

        {item.location && (
          <span className="booking-details__timeline-location">
            {" "}
            • {item.location}
          </span>
        )}
      </>
    ),
    time: formatDateTime(item.timestamp),
    actor: `${getActorLabel(item.actorType)}: ${item.actor}`,
  }));
}

/* ---------- Icons (inline so no extra dependency is needed) ---------- */
const ICON_PATHS: Record<string, React.ReactNode> = {
  back: (<><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  wrench: (<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  user: (<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  userPlus: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>),
  pin: (<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  bolt: (<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />),
  card: (<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>),
  phone: (<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />),
  mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  refresh: (<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  check: (<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>),
  warn: (<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4M12 17h.01" /></>),
  panelOpen: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m14 9 3 3-3 3" /></>),
  panelClose: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m16 9-3 3 3 3" /></>),
  rupee: (<><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></>),
};

const Icon: React.FC<{ name: keyof typeof ICON_PATHS | string; size?: number }> = ({
  name,
  size = 18,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {ICON_PATHS[name]}
  </svg>
);


/* ---------- Progress tracker ---------- */
const PROGRESS_STEPS = ["Booked", "Partner assigned", "In progress", "Completed"];

function getProgressIndex(status: string): number {
  switch (status) {
    case "assigned":
    case "en_route":
      return 1;
    case "arrived":
    case "in_progress":
      return 2;
    case "completed":
    case "rated":
      return 3;
    default:
      return 0;
  }
}

/* ---------- Slot helpers ---------- */
const SLOT_RANGE = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;

function toClock(value?: string): string {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
}

function clockToMinutes(clock: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** startTime may already be a "18:00-20:00" range; endTime may be an ISO timestamp. */
function formatSlot(slot?: { startTime?: string; endTime?: string }): {
  range: string;
  duration: string;
} {
  const start = slot?.startTime ?? "";
  let a = "";
  let b = "";
  if (SLOT_RANGE.test(start)) {
    [a, b] = start.split("-").map((part) => part.trim());
  } else {
    a = toClock(start);
    b = toClock(slot?.endTime);
  }
  if (!a && !b) return { range: "-", duration: "" };
  if (!a || !b || a === b) return { range: a || b, duration: "" };
  const from = clockToMinutes(a);
  const to = clockToMinutes(b);
  const diff = from !== null && to !== null && to > from ? to - from : 0;
  const duration = diff
    ? `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")} hrs`
    : "";
  return { range: `${a} – ${b}`, duration };
}

const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const Money: React.FC<{ value: unknown; negative?: boolean }> = ({
  value,
  negative,
}) =>
  isMoney(value) ? (
    <span>
      {negative && value > 0 ? "-" : ""}
      {formatAmount(value)}
    </span>
  ) : (
    <span className="bd__na">
      <Icon name="warn" size={15} />
      Not available
    </span>
  );

function paymentTone(status: string): string {
  switch (status) {
    case "Paid":
      return "paid";
    case "Failed":
      return "failed";
    case "Refunded":
      return "refunded";
    default:
      return "pending";
  }
}

export const BookingDrawer: React.FC<BookingDrawerProps> = ({
  booking,
  open,
  onClose,
  onAssignPartner,
  onStatusOverride,
  onCancelBooking,
  cancelOpen,
  onCancelOpen,
  onCancelClose,
}) => {
  const [localCancelOpen, setLocalCancelOpen] =
    useState(false);

  const cancelControlled = cancelOpen !== undefined;
  const showCancelForm = cancelControlled
    ? Boolean(cancelOpen)
    : localCancelOpen;

  const setShowCancelForm = (value: boolean) => {
    if (cancelControlled) {
      if (value) {
        onCancelOpen?.();
      } else {
        onCancelClose?.();
      }
      return;
    }

    setLocalCancelOpen(value);
  };

  const [cancelReason, setCancelReason] =
    useState("");

  const [cancelling, setCancelling] =
    useState(false);

  const [cancelError, setCancelError] =
    useState("");

  // Desktop: the details page starts after the admin sidebar so the sidebar stays visible and usable.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const sidebarCollapsed = useUIStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarWidth = useSidebarOffset();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cancelling) {
        if (showCancelForm) {
          setShowCancelForm(false);
          setCancelReason("");
          setCancelError("");
          return;
        }

        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    open,
    onClose,
    cancelling,
    showCancelForm,
  ]);

  useEffect(() => {
    if (!open || !booking) {
      setLocalCancelOpen(false);
      setCancelReason("");
      setCancelError("");
      setCancelling(false);
    }
  }, [open, booking]);

  if (!open || !booking) {
    return null;
  }

  const timelineItems =
    buildTimelineItems(booking);

  const isCancelled =
    booking.status === "cancelled_by_customer" ||
    booking.status === "cancelled_by_partner" ||
    booking.status === "cancelled_by_admin";

  const isCompleted =
    booking.status === "completed" ||
    booking.status === "rated";

  const canAssign =
    !isCancelled && !isCompleted && Boolean(onAssignPartner);

  const slot = formatSlot(booking.slot);

  // The API names these taxAmount / discountAmount; fall back to the old names for mock data.
  const pricing = booking.pricing;
  const taxValue = pricing.taxAmount ?? pricing.tax;
  const discountValue = pricing.discountAmount ?? pricing.discount;
  const addOnValue = pricing.addOnAmount ?? 0;
  const convenienceValue = pricing.convenienceFee ?? 0;

  const handleOpenCancelForm = () => {
    setShowCancelForm(true);
    setCancelReason("");
    setCancelError("");
  };

  const handleCloseCancelForm = () => {
    if (cancelling) {
      return;
    }

    setShowCancelForm(false);
    setCancelReason("");
    setCancelError("");
  };

  const handleCancelBooking = async () => {
    const reason = cancelReason.trim();

    if (!reason) {
      setCancelError(
        "Cancellation reason is required.",
      );
      return;
    }

    if (!onCancelBooking) {
      setCancelError(
        "Cancellation action is unavailable.",
      );
      return;
    }

    setCancelling(true);
    setCancelError("");

    try {
      await onCancelBooking(
        booking,
        reason,
      );

      setShowCancelForm(false);
      setCancelReason("");
      setCancelError("");
    } catch (err) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "Unable to cancel booking. Please try again.";

      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <style>{`
        .bd {
          --bd-bg: #f5f6fa;
          --bd-card: #ffffff;
          --bd-line: #e8ebf2;
          --bd-ink: #101828;
          --bd-sub: #5d667a;
          --bd-mute: #8b93a5;
          --bd-brand: #3730d9;
          --bd-brand-soft: #eef0ff;
          position: fixed;
          inset: 0 0 0 var(--booking-details-left, 0px);
          z-index: 1000;
          overflow-x: hidden;
          overflow-y: auto;
          background: var(--bd-bg);
          color: var(--bd-ink);
          font-size: 14px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          transition: left .2s ease;
        }
        .bd *, .bd *::before, .bd *::after { box-sizing: border-box; }
        .bd svg { flex: none; }

        /* ---------- Top bar ---------- */
        .bd__bar { position: sticky; top: 0; z-index: 20; background: #fff; border-bottom: 1px solid var(--bd-line); }
        .bd__bar-in { display: flex; align-items: center; gap: 10px; max-width: 1240px; margin: 0 auto; padding: 0 28px; height: 60px; }
        .bd__nav { display: inline-grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--bd-line); border-radius: 10px; background: #fff; color: var(--bd-sub); cursor: pointer; }
        .bd__nav:hover { background: #f4f5f9; }
        .bd__back { display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--bd-brand); font: inherit; font-weight: 600; cursor: pointer; }
        .bd__back:hover:not(:disabled) { background: var(--bd-brand-soft); }
        .bd__back:disabled { opacity: .5; cursor: not-allowed; }
        .bd__crumb { flex: 1; min-width: 0; margin: 0; color: var(--bd-ink); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bd__crumb span { margin-right: 8px; color: var(--bd-mute); font-weight: 400; }

        /* ---------- Page ---------- */
        .bd__main { max-width: 1240px; margin: 0 auto; padding: 24px 28px 64px; display: grid; gap: 20px; }

        /* Hero */
        .bd__hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
        .bd__eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--bd-mute); }
        .bd__title { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.25; overflow-wrap: anywhere; }
        .bd__sub { margin: 4px 0 0; color: var(--bd-sub); }
        .bd__sub i { margin: 0 8px; font-style: normal; color: #c3c8d4; }
        .bd__pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .bd__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; flex: none; }
        .bd__btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border: 1px solid #d9deea; border-radius: 10px; background: #fff; color: var(--bd-ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, box-shadow .15s; }
        .bd__btn:hover:not(:disabled) { background: #f8f9fc; border-color: #c6cddd; }
        .bd__btn:disabled { opacity: .55; cursor: not-allowed; }
        .bd__btn--primary { background: var(--bd-brand); border-color: var(--bd-brand); color: #fff; }
        .bd__btn--primary:hover:not(:disabled) { background: #2d27bd; border-color: #2d27bd; box-shadow: 0 6px 16px rgba(55,48,217,.25); }
        .bd__btn--danger { border-color: #f4c7c3; background: #fff; color: #d92d20; }
        .bd__btn--danger:hover:not(:disabled) { background: #fef3f2; border-color: #f0a9a3; }
        .bd__btn--sm { height: 36px; padding: 0 14px; }

        /* Cards */
        .bd__card { background: var(--bd-card); border: 1px solid var(--bd-line); border-radius: 14px; }
        .bd__card-h { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--bd-line); }
        .bd__card-h h2 { margin: 0; font-size: 15px; font-weight: 700; }
        .bd__chip { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--bd-brand-soft); color: var(--bd-brand); }
        .bd__card-b { padding: 18px 20px; }


        /* Progress tracker */
        .bd__track { margin: 0; padding: 18px 24px; list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .bd__step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--bd-mute); font-size: 13px; font-weight: 500; }
        .bd__step::before { content: ""; position: absolute; top: 13px; right: 50%; width: 100%; height: 2px; background: #e3e6ef; }
        .bd__step:first-child::before { display: none; }
        .bd__step-dot { position: relative; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid #d5dae6; font-size: 12px; font-weight: 700; color: var(--bd-mute); }
        .bd__step.is-done { color: var(--bd-ink); }
        .bd__step.is-done::before, .bd__step.is-current::before { background: var(--bd-brand); }
        .bd__step.is-done .bd__step-dot { background: var(--bd-brand); border-color: var(--bd-brand); color: #fff; }
        .bd__step.is-current { color: var(--bd-brand); font-weight: 700; }
        .bd__step.is-current .bd__step-dot { box-shadow: 0 0 0 4px var(--bd-brand-soft); }
        .bd__stopped { display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fef3f2; color: #b42318; font-weight: 600; }
        .bd__ref { display: inline-block; margin-left: 10px; padding: 2px 8px; border-radius: 6px; background: #eef0f6; color: var(--bd-sub); font-size: 12px; font-weight: 600; letter-spacing: .03em; vertical-align: middle; }

        /* Summary strip: one card, four cells */
        .bd__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 0; overflow: hidden; }
        .bd__fact { display: flex; align-items: flex-start; gap: 14px; min-width: 0; padding: 18px 20px; }
        .bd__fact + .bd__fact { border-left: 1px solid var(--bd-line); }
        .bd__fact-ico { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 10px; background: var(--bd-brand-soft); color: var(--bd-brand); }
        .bd__fact-body { min-width: 0; }
        .bd__fact-label { display: block; font-size: 12px; font-weight: 500; color: var(--bd-mute); text-transform: uppercase; letter-spacing: .04em; }
        .bd__fact-value { margin-top: 2px; font-size: 16px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
        .bd__fact-sub { margin-top: 2px; font-size: 13px; color: var(--bd-sub); }

        /* Two-column layout */
        .bd__grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; align-items: start; }
        .bd__stack { display: grid; gap: 20px; min-width: 0; }
        .bd__side { position: sticky; top: 80px; }
        .bd__people { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .bd__person { padding: 18px 20px; min-width: 0; }
        .bd__person + .bd__person { border-left: 1px solid var(--bd-line); }
        .bd__role { margin: 0 0 12px; font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--bd-mute); }
        .bd__who { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .bd__avatar { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--bd-brand-soft); color: var(--bd-brand); font-size: 17px; font-weight: 700; }
        .bd__who-name { margin: 0; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
        .bd__who-meta { margin: 0; color: var(--bd-sub); font-size: 13px; }
        .bd__contact { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .bd__contact li { display: flex; align-items: center; gap: 10px; min-width: 0; overflow-wrap: anywhere; color: var(--bd-ink); }
        .bd__contact svg { color: var(--bd-mute); }

        .bd__noone { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: var(--bd-sub); font-size: 13.5px; }
        .bd__noone p { margin: 0; }

        .bd__addr { display: flex; gap: 12px; align-items: flex-start; }
        .bd__addr svg { margin-top: 3px; color: var(--bd-mute); }
        .bd__addr-lines { margin: 0; font-style: normal; line-height: 1.65; overflow-wrap: anywhere; }

        /* Timeline */
        .bd__tl { margin: 0; padding: 0; list-style: none; }
        .bd__tl li { position: relative; padding: 0 0 20px 28px; }
        .bd__tl li:last-child { padding-bottom: 0; }
        .bd__tl li::before { content: ""; position: absolute; left: 6px; top: 18px; bottom: 0; width: 2px; background: #e3e6ef; }
        .bd__tl li:last-child::before { display: none; }
        .bd__tl-dot { position: absolute; left: 0; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: #cfd4e1; border: 3px solid #fff; box-shadow: 0 0 0 1px #e3e6ef; }
        .bd__tl li:last-child .bd__tl-dot { background: var(--bd-brand); box-shadow: 0 0 0 1px var(--bd-brand); }
        .bd__tl-title { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
        .bd__tl-desc { margin: 0; font-size: 13.5px; color: var(--bd-sub); overflow-wrap: anywhere; }
        .bd__tl-meta { margin: 2px 0 0; font-size: 12.5px; color: var(--bd-mute); overflow-wrap: anywhere; }
        .bd__empty { margin: 0; color: var(--bd-mute); }

        /* Payment */
        .bd__rows { margin: 0; display: grid; gap: 10px; }
        .bd__row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
        .bd__row dt { color: var(--bd-sub); }
        .bd__row dd { margin: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .bd__row--kv dd { font-weight: 500; }
        .bd__na { display: inline-flex; align-items: center; gap: 6px; color: #d92d20; font-weight: 500; }
        .bd__total { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; padding: 14px; border-radius: 10px; background: #f7f8fc; font-size: 16px; font-weight: 700; }
        .bd__banner { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 10px 12px; border-radius: 10px; font-weight: 600; text-transform: capitalize; }
        .bd__banner--paid { background: #e7f8ee; color: #067647; }
        .bd__banner--failed { background: #fef3f2; color: #b42318; }
        .bd__banner--refunded { background: #f2f4f7; color: #475467; }
        .bd__banner--pending { background: #fffaeb; color: #b54708; }
        .bd__divider { height: 1px; margin: 16px 0; background: var(--bd-line); }

        /* ---------- Status pills ---------- */
        .booking-details__status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap; background: #f2f4f7; color: #475467; }
        .booking-details__status--completed, .booking-details__status--paid { background: #e7f8ee; color: #067647; }
        .booking-details__status--cancelled, .booking-details__status--failed { background: #fef3f2; color: #b42318; }
        .booking-details__status--progress { background: #eff8ff; color: #175cd3; }
        .booking-details__status--assigned { background: #f4f3ff; color: #5925dc; }
        .booking-details__status--confirmed { background: #e7f8ee; color: #067647; }
        .booking-details__status--pending, .booking-details__status--payment-pending { background: #fffaeb; color: #b54708; }
        .booking-details__status--refunded { background: #f2f4f7; color: #475467; }
        .bd__tag { display: inline-block; margin-top: 4px; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
        .bd__tag--paid { background: #e7f8ee; color: #067647; }
        .bd__tag--failed { background: #fef3f2; color: #b42318; }
        .bd__tag--refunded { background: #f2f4f7; color: #475467; }
        .bd__tag--pending { background: #fffaeb; color: #b54708; }

        /* ---------- Responsive ---------- */
        @media (max-width: 1100px) {
          .bd__grid { grid-template-columns: minmax(0, 1fr); }
          .bd__side { position: static; }
          .bd__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .bd__fact:nth-child(3) { border-left: 0; }
          .bd__fact:nth-child(n + 3) { border-top: 1px solid var(--bd-line); }
        }
        @media (max-width: 760px) {
          .bd__bar-in { padding: 0 14px; height: 54px; }
          .bd__main { padding: 16px 14px 120px; gap: 14px; }
          .bd__grid, .bd__stack { gap: 14px; }
          .bd__hero { flex-direction: column; gap: 14px; }
          .bd__title { font-size: 21px; }
          .bd__track { padding: 14px 8px; }
          .bd__step { font-size: 11.5px; }
          .bd__fact { padding: 14px; gap: 10px; }
          .bd__fact-ico { width: 32px; height: 32px; }
          .bd__fact-value { font-size: 14.5px; }
          .bd__people { grid-template-columns: minmax(0, 1fr); }
          .bd__person + .bd__person { border-left: 0; border-top: 1px solid var(--bd-line); }
          .bd__actions { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); background: #fff; border-top: 1px solid var(--bd-line); box-shadow: 0 -8px 24px rgba(15,20,36,.08); }
          .bd__actions .bd__btn { flex: 1 1 auto; }
        }
      `}</style>

      <main
        className="bd"
        aria-labelledby="booking-details-title"
        style={
          {
            "--booking-details-left": `${sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        <header className="bd__bar">
          <div className="bd__bar-in">
            {isDesktop && (
              <button
                type="button"
                className="bd__nav"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
                title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
              >
                <Icon name={sidebarCollapsed ? "panelOpen" : "panelClose"} size={18} />
              </button>
            )}
            <button
              type="button"
              className="bd__back"
              onClick={onClose}
              disabled={cancelling}
              aria-label="Back to bookings"
            >
              <Icon name="back" size={16} />
              Bookings
            </button>
            <span style={{ flex: 1 }} />
            <NotificationBell />
          </div>
        </header>

        <div className="bd__main">
          <div className="bd__hero">
            <div style={{ minWidth: 0 }}>
              <p className="bd__eyebrow">Booking details</p>
              <h1 id="booking-details-title" className="bd__title">
                {booking.service.name}
                <span className="bd__ref">#{String(booking.id).slice(-8).toUpperCase()}</span>
              </h1>
              <p className="bd__sub">
                {booking.customer.name || "Customer"}
                <i>•</i>
                {booking.city}
                <i>•</i>
                Created {formatDateTime(booking.createdAt)}
              </p>
              <div className="bd__pills">
                <span className={getStatusClass(booking.status)}>
                  <Icon name="check" size={15} />
                  {getStatusLabel(booking.status)}
                </span>
                <span className={getPaymentClass(booking.payment.status)}>
                  <Icon name="card" size={15} />
                  Payment {booking.payment.status}
                </span>
              </div>
            </div>

            <div className="bd__actions">
              {!isCancelled && !isCompleted && (
                <button
                  type="button"
                  className="bd__btn bd__btn--danger"
                  onClick={handleOpenCancelForm}
                  disabled={cancelling || showCancelForm}
                >
                  Cancel booking
                </button>
              )}
              {!isCancelled && onStatusOverride && (
                <button
                  type="button"
                  className="bd__btn"
                  onClick={() => onStatusOverride(booking)}
                  disabled={cancelling}
                >
                  <Icon name="refresh" size={16} />
                  Override status
                </button>
              )}
              {canAssign && (
                <button
                  type="button"
                  className="bd__btn bd__btn--primary"
                  onClick={() => onAssignPartner?.(booking)}
                  disabled={cancelling}
                >
                  <Icon name="userPlus" size={16} />
                  {booking.partner ? "Reassign partner" : "Assign partner"}
                </button>
              )}
            </div>
          </div>

          <section className="bd__card" aria-label="Booking progress">
            {isCancelled || booking.status === "no_show" || booking.status === "disputed" ? (
              <div className="bd__stopped">
                <Icon name="warn" size={18} />
                {getStatusLabel(booking.status)}
              </div>
            ) : (
              <ol className="bd__track">
                {PROGRESS_STEPS.map((label, index) => {
                  const current = getProgressIndex(booking.status);
                  const done = index <= current && !(index === current && current < 3);
                  return (
                    <li
                      key={label}
                      className={`bd__step${done ? " is-done" : ""}${index === current && current < 3 ? " is-current" : ""}`}
                      aria-current={index === current ? "step" : undefined}
                    >
                      <span className="bd__step-dot">{done ? "✓" : index + 1}</span>
                      {label}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="bd__card bd__facts" aria-label="Booking summary">
            <div className="bd__fact">
              <span className="bd__fact-ico"><Icon name="calendar" size={18} /></span>
              <div className="bd__fact-body">
                <span className="bd__fact-label">Date &amp; time</span>
                <div className="bd__fact-value">{formatDate(booking.slot.date)}</div>
                <div className="bd__fact-sub">
                  {slot.range}
                  {slot.duration ? ` (${slot.duration})` : ""}
                </div>
              </div>
            </div>
            <div className="bd__fact">
              <span className="bd__fact-ico"><Icon name="wrench" size={18} /></span>
              <div className="bd__fact-body">
                <span className="bd__fact-label">Service</span>
                <div className="bd__fact-value">{booking.service.category || "-"}</div>
                <div className="bd__fact-sub">{booking.service.durationMinutes} minutes</div>
              </div>
            </div>
            <div className="bd__fact">
              <span className="bd__fact-ico"><Icon name="users" size={18} /></span>
              <div className="bd__fact-body">
                <span className="bd__fact-label">Partner</span>
                <div className="bd__fact-value">{booking.partner ? booking.partner.name : "Unassigned"}</div>
                <div className="bd__fact-sub">{booking.partner ? booking.partner.category : "Awaiting assignment"}</div>
              </div>
            </div>
            <div className="bd__fact">
              <span className="bd__fact-ico"><Icon name="rupee" size={18} /></span>
              <div className="bd__fact-body">
                <span className="bd__fact-label">Total</span>
                <div className="bd__fact-value">{formatAmount(booking.pricing.totalAmount)}</div>
                <span className={`bd__tag bd__tag--${paymentTone(booking.payment.status)}`}>
                  {booking.payment.status}
                </span>
              </div>
            </div>
          </section>

          <div className="bd__grid">
            <div className="bd__stack">
              <section className="bd__card">
                <div className="bd__people">
                  <div className="bd__person">
                    <p className="bd__role">Customer</p>
                    <div className="bd__who">
                      <div className="bd__avatar" aria-hidden="true">
                        {(booking.customer.name || "C").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="bd__who-name">{booking.customer.name || "-"}</p>
                        <p className="bd__who-meta">Booked this service</p>
                      </div>
                    </div>
                    <ul className="bd__contact">
                      <li><Icon name="phone" size={15} />{booking.customer.phone || "-"}</li>
                      <li><Icon name="mail" size={15} />{booking.customer.email || "-"}</li>
                    </ul>
                  </div>

                  <div className="bd__person">
                    <p className="bd__role">Partner</p>
                    {booking.partner ? (
                      <>
                        <div className="bd__who">
                          <div className="bd__avatar" aria-hidden="true">
                            {(booking.partner.name || "P").charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p className="bd__who-name">{booking.partner.name}</p>
                            <p className="bd__who-meta">{booking.partner.category}</p>
                          </div>
                        </div>
                        <ul className="bd__contact">
                          <li><Icon name="phone" size={15} />{booking.partner.phone || "-"}</li>
                          <li><Icon name="mail" size={15} />{booking.partner.email || "-"}</li>
                        </ul>
                      </>
                    ) : (
                      <div className="bd__noone">
                        <p>No partner is assigned to this booking yet.</p>
                        {canAssign && (
                          <button
                            type="button"
                            className="bd__btn bd__btn--primary bd__btn--sm"
                            onClick={() => onAssignPartner?.(booking)}
                            disabled={cancelling}
                          >
                            <Icon name="userPlus" size={15} />
                            Assign partner
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="bd__card">
                <div className="bd__card-h">
                  <span className="bd__chip"><Icon name="pin" size={16} /></span>
                  <h2>Service address</h2>
                </div>
                <div className="bd__card-b">
                  <div className="bd__addr">
                    <address className="bd__addr-lines">
                      {[
                        booking.address.line1,
                        booking.address.line2,
                        booking.address.area,
                        [booking.address.city, booking.address.state].filter(Boolean).join(", "),
                        booking.address.pincode,
                      ]
                        .filter(Boolean)
                        .map((line, index) => (
                          <React.Fragment key={index}>
                            {index > 0 && <br />}
                            {line}
                          </React.Fragment>
                        ))}
                    </address>
                  </div>
                </div>
              </section>

              <section className="bd__card">
                <div className="bd__card-h">
                  <span className="bd__chip"><Icon name="bolt" size={16} /></span>
                  <h2>Activity</h2>
                </div>
                <div className="bd__card-b">
                  {timelineItems.length === 0 ? (
                    <p className="bd__empty">No booking activity yet.</p>
                  ) : (
                    <ol className="bd__tl">
                      {timelineItems.map((item) => (
                        <li key={item.id}>
                          <span className="bd__tl-dot" aria-hidden="true" />
                          <p className="bd__tl-title">{item.title}</p>
                          {item.description && <p className="bd__tl-desc">{item.description}</p>}
                          {(item.actor || item.time) && (
                            <p className="bd__tl-meta">
                              {item.actor}
                              {item.actor && item.time ? ", " : ""}
                              {item.time}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </div>

            <aside className="bd__card bd__side">
              <div className="bd__card-h">
                <span className="bd__chip"><Icon name="card" size={16} /></span>
                <h2>Payment summary</h2>
              </div>
              <div className="bd__card-b">
                <div className={`bd__banner bd__banner--${paymentTone(booking.payment.status)}`}>
                  <Icon name="check" size={17} />
                  Payment {booking.payment.status}
                </div>

                <dl className="bd__rows">
                  <div className="bd__row"><dt>Base amount</dt><dd><Money value={pricing.baseAmount} /></dd></div>
                  {addOnValue > 0 && (
                    <div className="bd__row"><dt>Add-ons</dt><dd><Money value={addOnValue} /></dd></div>
                  )}
                  {convenienceValue > 0 && (
                    <div className="bd__row"><dt>Convenience fee</dt><dd><Money value={convenienceValue} /></dd></div>
                  )}
                  <div className="bd__row"><dt>Tax</dt><dd><Money value={taxValue} /></dd></div>
                  <div className="bd__row"><dt>Discount</dt><dd><Money value={discountValue} negative /></dd></div>
                </dl>
                <div className="bd__total">
                  <span>Total</span>
                  <span>{formatAmount(booking.pricing.totalAmount)}</span>
                </div>

                <div className="bd__divider" />

                <dl className="bd__rows">
                  <div className="bd__row bd__row--kv"><dt>Method</dt><dd>{booking.payment.method || "-"}</dd></div>
                  <div className="bd__row bd__row--kv"><dt>Amount</dt><dd>{isMoney(booking.payment.amount) ? formatAmount(booking.payment.amount) : "-"}</dd></div>
                  <div className="bd__row bd__row--kv"><dt>Payment ID</dt><dd>{booking.payment.paymentId || "-"}</dd></div>
                  {booking.payment.paidAt && (
                    <div className="bd__row bd__row--kv"><dt>Paid at</dt><dd>{formatDateTime(booking.payment.paidAt)}</dd></div>
                  )}
                </dl>

                <div className="bd__divider" />

                <dl className="bd__rows">
                  <div className="bd__row bd__row--kv"><dt>Created</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>
                  <div className="bd__row bd__row--kv"><dt>Updated</dt><dd>{formatDateTime(booking.updatedAt)}</dd></div>
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </main>
      {showCancelForm &&
        !isCancelled &&
        !isCompleted && (
          <BookingActionPanel
            title="Cancel Booking"
            subtitle="The reason will be recorded in the booking activity history."
            titleId="booking-cancel-screen-title"
            onClose={handleCloseCancelForm}
            closeDisabled={cancelling}
            closeLabel="Close cancellation"
            footer={
              <>
                <button
                  type="button"
                  className="bk-btn"
                  onClick={handleCloseCancelForm}
                  disabled={cancelling}
                >
                  Keep Booking
                </button>

                <button
                  type="button"
                  className="bk-btn bk-btn--danger"
                  onClick={handleCancelBooking}
                  disabled={cancelling || !cancelReason.trim()}
                >
                  {cancelling
                    ? "Cancelling..."
                    : "Confirm Cancellation"}
                </button>
              </>
            }
          >
            <div className="bk-facts">
              <div className="bk-fact">
                <span className="bk-fact__label">Customer</span>
                <div className="bk-fact__value">
                  {booking.customer.name || "-"}
                </div>
              </div>

              <div className="bk-fact">
                <span className="bk-fact__label">Service</span>
                <div className="bk-fact__value">
                  {booking.service.name}
                </div>
              </div>
            </div>

            <div className="bk-card">
              <div className="bk-field">
                <label
                  htmlFor="booking-cancel-reason"
                  className="bk-label"
                >
                  Cancellation reason{" "}
                  <span className="bk-required">*</span>
                </label>

                <textarea
                  id="booking-cancel-reason"
                  className={[
                    "bk-textarea",
                    cancelError ? "bk-textarea--error" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  value={cancelReason}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    setCancelError("");
                  }}
                  placeholder="Enter the reason for cancelling this booking"
                  disabled={cancelling}
                  aria-required="true"
                  aria-invalid={Boolean(cancelError)}
                  autoFocus
                />

                {!cancelError && (
                  <p className="bk-help">
                    Example: Customer requested cancellation, partner
                    unavailable, duplicate booking, or other
                    operational reason.
                  </p>
                )}

                {cancelError && (
                  <p className="bk-error" role="alert">
                    {cancelError}
                  </p>
                )}
              </div>
            </div>
          </BookingActionPanel>
        )}
    </>
  );
};

export default BookingDrawer;