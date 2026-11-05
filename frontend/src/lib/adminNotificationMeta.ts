import {
  AlertTriangle,
  Bell,
  CalendarPlus,
  CircleDollarSign,
  FileCheck2,
  GraduationCap,
  LifeBuoy,
  Timer,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { AdminNotification } from '@/services/adminNotificationApi';

/** How each notification type looks in the admin bell and on /admin/notifications. */
export interface NotificationMeta {
  title: string;
  Icon: LucideIcon;
  /** Tailwind classes for the round icon badge (full page). */
  tone: string;
}

const SOS_META: NotificationMeta = { title: 'SOS alert', Icon: AlertTriangle, tone: 'bg-red-100 text-red-600' };

export const NOTIFICATION_META: Record<string, NotificationMeta> = {
  'sos.alert': SOS_META,
  'partner:sos': SOS_META,
  'kyc.submitted': { title: 'KYC submitted', Icon: FileCheck2, tone: 'bg-violet-100 text-violet-600' },
  'training.completed': { title: 'Training completed', Icon: GraduationCap, tone: 'bg-emerald-100 text-emerald-600' },
  'refund.requested': { title: 'Refund requested', Icon: CircleDollarSign, tone: 'bg-amber-100 text-amber-600' },
  'payout.failed': { title: 'Payout failed', Icon: Wallet, tone: 'bg-red-100 text-red-600' },
  'sla.breach': { title: 'SLA breach', Icon: Timer, tone: 'bg-orange-100 text-orange-600' },
  'booking.created': { title: 'New booking', Icon: CalendarPlus, tone: 'bg-indigo-100 text-indigo-600' },
  'booking.cancelled': { title: 'Booking cancelled', Icon: XCircle, tone: 'bg-amber-100 text-amber-600' },
  'ticket.created': { title: 'New support ticket', Icon: LifeBuoy, tone: 'bg-sky-100 text-sky-600' },
  'ticket.reply': { title: 'New ticket reply', Icon: LifeBuoy, tone: 'bg-sky-100 text-sky-600' },
  'refund.updated': { title: 'Refund updated', Icon: CircleDollarSign, tone: 'bg-emerald-100 text-emerald-600' },
  'payment.failed': { title: 'Payment failed', Icon: CircleDollarSign, tone: 'bg-red-100 text-red-600' },
};

/** Unknown / future types still render: "some.new_type" -> "Some new type". */
export const notificationMeta = (type: string): NotificationMeta =>
  NOTIFICATION_META[type] ?? { title: type.replace(/[._:]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), Icon: Bell, tone: 'bg-gray-100 text-gray-600' };

/** A usable id from the payload; demo/seed ids ("demo-booking-1") never link anywhere. */
const idOf = (payload: AdminNotification['payload'], key: string): string | null => {
  const v = payload?.[key];
  return typeof v === 'string' && v && !v.startsWith('demo') ? v : null;
};
const enc = encodeURIComponent;

/**
 * Where clicking a notification goes. Always an in-app /admin path (ids are URL-encoded, nothing from the
 * payload is ever used as a raw URL). Falls back to the list page of that area, then to /admin/notifications.
 */
export function notificationTarget(n: Pick<AdminNotification, 'type' | 'payload'>): string {
  const p = n.payload;
  const booking = idOf(p, 'bookingId');
  const partner = idOf(p, 'partnerId');
  const refund = idOf(p, 'refundId');
  const payout = idOf(p, 'payoutId');
  const ticket = idOf(p, 'ticketId');
  const payment = idOf(p, 'paymentId');

  switch (n.type) {
    case 'sos.alert':
    case 'partner:sos':
      return booking ? `/admin/bookings?booking=${enc(booking)}` : partner ? `/admin/partners/${enc(partner)}` : '/admin/notifications';
    case 'kyc.submitted':
    case 'training.completed':
      return partner ? `/admin/partners/${enc(partner)}` : '/admin/partners';
    case 'refund.requested':
    case 'refund.updated':
      return refund ? `/admin/refunds/${enc(refund)}` : '/admin/refunds';
    case 'payout.failed':
      return payout ? `/admin/payouts/${enc(payout)}` : '/admin/payouts';
    case 'sla.breach':
    case 'ticket.created':
    case 'ticket.reply':
      return ticket ? `/admin/support/${enc(ticket)}` : '/admin/support';
    case 'payment.failed':
      return payment ? `/admin/payments/${enc(payment)}` : '/admin/payments';
    default:
      if (booking) return `/admin/bookings?booking=${enc(booking)}`;
      if (ticket) return `/admin/support/${enc(ticket)}`;
      return '/admin/notifications';
  }
}