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
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The tabs on the customer notifications page. Every type belongs to exactly one group. */
export const NOTIFICATION_GROUPS = ['booking', 'payment', 'partner', 'offers', 'support', 'system'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** Type prefix -> group. Anything that matches no prefix (including future types) is 'system'. */
export const GROUP_PREFIXES: Record<Exclude<NotificationGroup, 'system'>, readonly string[]> = {
  booking: ['booking.'],
  payment: ['payment.', 'payout.', 'refund.'],
  partner: ['partner.'],
  offers: ['offer.'],
  support: ['ticket.', 'support.'],
};

export const groupOf = (type: string): NotificationGroup => {
  for (const [group, prefixes] of Object.entries(GROUP_PREFIXES)) {
    if (prefixes.some((p) => type.startsWith(p))) return group as NotificationGroup;
  }
  return 'system';
};

/** Socket.IO event the clients listen for. */
export const NOTIFICATION_SOCKET_EVENT = 'notification:new';

export const NOTIFICATIONS_CONSTANTS = { NOTIFICATION_TYPES, NOTIFICATION_GROUPS, GROUP_PREFIXES, NOTIFICATION_SOCKET_EVENT };
