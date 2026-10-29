export const NOTIFICATION_TYPES = [
  'booking.created',
  'booking.assigned',
  'booking.cancelled',
  'booking.completed',
  'partner.approved',
  'partner.rejected',
  'payout.processed',
  'refund.updated',
  'payment.succeeded',
  'payment.failed',
  'offer.new',
  'ticket.reply',
  'system.announcement',
  /** A partner or customer pressed SOS. Admins see it highlighted in the bell and it can never be muted. */
  'sos.alert',
  /** Admin-only alerts (live in the admin bell). Raised by the helpers in admin-alerts.ts. */
  'kyc.submitted',
  'refund.requested',
  'payout.failed',
  'sla.breach',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_GROUPS = [
  'booking',
  'offers',
  'partner',
  'payment',
  'support',
  'system',
] as const;

export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/**
 * Prefixes used to group notifications.
 * Keep these in sync with groupOf().
 */
export const GROUP_PREFIXES: Record<
  Exclude<NotificationGroup, 'system'>,
  readonly string[]
> = {
  booking: ['booking.'],
  offers: ['offer.'],
  partner: ['partner.', 'kyc.'],
  payment: ['payment.', 'payout.', 'refund.'],
  support: ['ticket.'],
};

export const SYSTEM_NOTIFICATION_TYPES = new Set<string>([
  ...NOTIFICATION_TYPES,
  'payment.succeeded',
  'payment.failed',
  'offer.new',
]);

/** Type prefixes per group; 'system' is whatever matches none of these. Mirrors groupOf(). */
export const GROUP_PREFIXES: Record<Exclude<NotificationGroup, 'system'>, readonly string[]> = {
  booking: ['booking.'],
  payment: ['payment.', 'payout.', 'refund.'],
  partner: ['partner.'],
  offers: ['offer.'],
  support: ['ticket.'],
};

export function groupOf(type: string): NotificationGroup {
  if (type.startsWith('booking.')) return 'booking';
  if (
    type.startsWith('payment.') ||
    type.startsWith('payout.') ||
    type.startsWith('refund.') ||
    type === 'payout.processed' ||
    type === 'refund.updated'
  ) {
    return 'payment';
  }
  if (type.startsWith('partner.')) return 'partner';
  if (type.startsWith('offer.')) return 'offers';
  if (type.startsWith('ticket.')) return 'support';
  return 'system';
}

/** Types that must stand out in the admin bell. */
export const HIGH_PRIORITY_TYPES: readonly string[] = ['sos.alert'];

/** Admin-facing types an admin can switch off on the Settings page (setting key per type). SOS is not listed on purpose. */
export const ADMIN_ALERT_SETTING: Partial<Record<(typeof NOTIFICATION_TYPES)[number], 'notifications.adminBookingAlerts' | 'notifications.adminTicketAlerts'>> = {
  'booking.created': 'notifications.adminBookingAlerts',
  'ticket.reply': 'notifications.adminTicketAlerts',
};

/** Socket.IO event the clients listen for. */
export const NOTIFICATION_SOCKET_EVENT = 'notification:new';

export const NOTIFICATIONS_CONSTANTS = {
  NOTIFICATION_TYPES,
  NOTIFICATION_GROUPS,
  GROUP_PREFIXES,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
  GROUP_PREFIXES,
  ADMIN_ALERT_SETTING,
  HIGH_PRIORITY_TYPES,
  SYSTEM_NOTIFICATION_TYPES,
};
