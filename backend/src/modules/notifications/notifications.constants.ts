export const NOTIFICATION_TYPES = [
  'booking.created',
  'booking.assigned',
  'booking.cancelled',
  'booking.completed',
  /** Customer-facing booking updates. Raised by the helpers in customer-alerts.ts. */
  'booking.confirmed',
  'booking.rescheduled',
  'booking.partner_arrived',
  'booking.started',
  'partner.approved',
  'partner.rejected',
  'payout.processed',
  'refund.updated',
  'payment.succeeded',
  'payment.failed',
  'offer.new',
  'ticket.reply',
  /** Admin-only: a customer or partner raised a new support ticket. */
  'ticket.created',
  'system.announcement',
  /** A partner or customer pressed SOS. Admins see it highlighted in the bell and it can never be muted. */
  'sos.alert',
  /** Admin-only alerts (live in the admin bell). Raised by the helpers in admin-alerts.ts. */
  'kyc.submitted',
  /** A partner finished every training step and waits for an admin to approve it. */
  'training.completed',
  'refund.requested',
  'payout.failed',
  'sla.breach',
  /** A partner asked to add a new skill; an admin must approve it. */
  'skill.requested',
  /** An admin approved or rejected a partner's skill request. */
  'skill.reviewed',
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
  payment: ['payment.', 'payout.', 'refund.'],
  partner: ['partner.', 'kyc.', 'training.', 'skill.'],
  offers: ['offer.'],
  support: ['ticket.', 'support.'],
};

export const SYSTEM_NOTIFICATION_TYPES = new Set<string>([
  ...NOTIFICATION_TYPES,
  'payment.succeeded',
  'payment.failed',
  'offer.new',
]);

/**
 * Returns the group associated with a notification type.
 */
export function groupOf(type: string): NotificationGroup {
  for (const [group, prefixes] of Object.entries(GROUP_PREFIXES)) {
    if (prefixes.some((p) => type.startsWith(p))) {
      return group as NotificationGroup;
    }
  }
  return 'system';
}

/** Types that must stand out in the admin bell. */
export const HIGH_PRIORITY_TYPES: readonly string[] = ['sos.alert'];

/** Admin-facing types an admin can switch off on the Settings page (setting key per type). SOS is not listed on purpose. */
export const ADMIN_ALERT_SETTING: Partial<Record<(typeof NOTIFICATION_TYPES)[number], 'notifications.adminBookingAlerts' | 'notifications.adminTicketAlerts'>> = {
  'booking.created': 'notifications.adminBookingAlerts',
  'ticket.reply': 'notifications.adminTicketAlerts',
  'ticket.created': 'notifications.adminTicketAlerts',
};

/** Socket.IO event the clients listen for. */
export const NOTIFICATION_SOCKET_EVENT = 'notification:new';

export const NOTIFICATIONS_CONSTANTS = {
  NOTIFICATION_TYPES,
  NOTIFICATION_GROUPS,
  GROUP_PREFIXES,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
  ADMIN_ALERT_SETTING,
  HIGH_PRIORITY_TYPES,
  SYSTEM_NOTIFICATION_TYPES,
};