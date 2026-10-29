import { CalendarCheck, CreditCard, Info, LifeBuoy, Tag, UserCheck, type LucideIcon } from "lucide-react";
import { customerPath } from "@/routes/customerPath";
import type { CustomerNotification, NotificationGroup } from "@/services/notificationApi";

export const GROUP_META: Record<NotificationGroup, { label: string; icon: LucideIcon; tint: string }> = {
  booking: { label: "Booking", icon: CalendarCheck, tint: "bg-indigo-50 text-indigo-700" },
  payment: { label: "Payment", icon: CreditCard, tint: "bg-emerald-50 text-emerald-700" },
  partner: { label: "Partner", icon: UserCheck, tint: "bg-sky-50 text-sky-700" },
  offers: { label: "Offers", icon: Tag, tint: "bg-orange-50 text-orange-700" },
  support: { label: "Support", icon: LifeBuoy, tint: "bg-violet-50 text-violet-700" },
  system: { label: "System", icon: Info, tint: "bg-slate-100 text-slate-700" },
};

export const isNotificationGroup = (v: string | null): v is NotificationGroup => v !== null && v in GROUP_META;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const objectId = (v: unknown): string | undefined => (typeof v === "string" && OBJECT_ID.test(v) ? v : undefined);

const rupees = (n: number): string => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

const TEXT: Record<string, { title: string; message: string }> = {
  "booking.created": { title: "Booking placed", message: "We've received your booking and are finding the right partner." },
  "booking.confirmed": { title: "Booking confirmed", message: "Your booking is confirmed." },
  "booking.assigned": { title: "Partner assigned", message: "A partner has been assigned to your booking." },
  "booking.cancelled": { title: "Booking cancelled", message: "Your booking was cancelled." },
  "booking.completed": { title: "Service completed", message: "How did it go? Rate your service to help others." },
  "partner.approved": { title: "Partner update", message: "Your partner has been confirmed." },
  "partner.rejected": { title: "Partner update", message: "Your partner couldn't take this job. We're finding another one." },
  "payout.processed": { title: "Payout processed", message: "A payout has been processed." },
  "payment.succeeded": { title: "Payment successful", message: "Your payment was received." },
  "payment.failed": { title: "Payment failed", message: "Your payment didn't go through. You can try again from the booking." },
  "offer.new": { title: "New offer", message: "A new offer is available for you." },
  "ticket.reply": { title: "Support replied", message: "Our team replied to your support ticket." },
  "system.announcement": { title: "Announcement", message: "There's an update from HomeCareX." },
};

const humanize = (type: string): string => {
  const s = type.replace(/[._]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Notification";
};

/**
 * What to show for a notification. The server may send its own `title` / `message` in the payload;
 * otherwise we write one from the type. Unknown types still render (never a blank row).
 */
export function describeNotification(n: Pick<CustomerNotification, "type" | "payload">): { title: string; message: string } {
  const payload = n.payload ?? {};
  const own = { title: str(payload.title), message: str(payload.message) };

  let base = TEXT[n.type];
  if (n.type === "refund.updated") {
    const status = str(payload.status) ?? "updated";
    const amount = typeof payload.amount === "number" ? ` of ${rupees(payload.amount)}` : "";
    base = { title: "Refund update", message: `Your refund${amount} is ${status.replace(/_/g, " ")}.` };
  }
  base ??= { title: humanize(n.type), message: "Open the app for details." };

  return { title: own.title ?? base.title, message: own.message ?? base.message };
}

export interface NotificationTargets {
  bookingId?: string;
  ticketId?: string;
}

/** Ids we can safely deep-link to. Anything that isn't a valid id is ignored. */
export function notificationTargets(n: Pick<CustomerNotification, "payload">): NotificationTargets {
  const p = n.payload ?? {};
  return { bookingId: objectId(p.bookingId), ticketId: objectId(p.ticketId) };
}

export const bookingHref = (id: string): string => customerPath(`/bookings/${id}`);
export const ticketHref = (id: string): string => `${customerPath("/support/tickets")}?ticket=${id}`;
export const reviewHref = (bookingId: string): string => `${customerPath("/reviews")}?booking=${bookingId}`;

const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today" / "Yesterday" / "Earlier", for the headings in the list. */
export function dayBucket(iso: string, now: Date = new Date()): "Today" | "Yesterday" | "Earlier" {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "Earlier";
  const diffDays = Math.round((dayStart(now) - dayStart(t)) / 86_400_000);
  return diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : "Earlier";
}

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export const fullDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateTime.format(d);
};

/** "Just now", "5 min ago", "3 h ago", then the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const mins = Math.floor((now.getTime() - t.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && dayBucket(iso, now) === "Today") return `${hours} h ago`;
  return dateOnly.format(t);
}