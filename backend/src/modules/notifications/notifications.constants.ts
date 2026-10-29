
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
  'sos.alert',
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
]);

/**
 * Returns the group associated with a notification type.
 */
export function groupOf(type: string): NotificationGroup {
  if (type.startsWith('booking.')) {
    return 'booking';
  }

  if (
    type.startsWith('payment.') ||
    type.startsWith('payout.') ||
    type.startsWith('refund.')
  ) {
    return 'payment';
  }

  if (type.startsWith('partner.') || type.startsWith('kyc.')) {
    return 'partner';
  }

  if (type.startsWith('offer.')) {
    return 'offers';
  }

  if (type.startsWith('ticket.')) {
    return 'support';
  }

  return 'system';
}

/** Types that must stand out in the admin bell. */
export const HIGH_PRIORITY_TYPES: readonly string[] = ['sos.alert'];

/**
 * Admin notification types that can be disabled through Settings.
 * SOS is intentionally excluded because it must never be muted.
 */
export const ADMIN_ALERT_SETTING: Partial<
  Record<
    NotificationType,
    | 'notifications.adminBookingAlerts'
    | 'notifications.adminTicketAlerts'
  >
> = {
  'booking.created': 'notifications.adminBookingAlerts',
  'ticket.reply': 'notifications.adminTicketAlerts',
};

/** Socket.IO event the clients listen for. */
export const NOTIFICATION_SOCKET_EVENT = 'notification:new';

export const NOTIFICATIONS_CONSTANTS = {
  NOTIFICATION_TYPES,
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
  GROUP_PREFIXES,
  ADMIN_ALERT_SETTING,
  HIGH_PRIORITY_TYPES,
  SYSTEM_NOTIFICATION_TYPES,
};
