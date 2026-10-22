export const NOTIFICATION_TYPES = [
  'booking.created',
  'booking.assigned',
  'booking.cancelled',
  'booking.completed',
  'partner.approved',
  'partner.rejected',
  'payout.processed',
  'refund.updated',
  'ticket.reply',
  'system.announcement',
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

export function groupOf(type: string): NotificationGroup {
  if (type.startsWith('booking.')) return 'booking';
  if (type.startsWith('payment.') || type.startsWith('payout.') || type.startsWith('refund.')) return 'payment';
  if (type.startsWith('partner.')) return 'partner';
  if (type.startsWith('offer.')) return 'offers';
  if (type.startsWith('ticket.')) return 'support';
  return 'system';
}

/** Socket.IO event the clients listen for. */
export const NOTIFICATION_SOCKET_EVENT = 'notification:new';

export const NOTIFICATIONS_CONSTANTS = {
  NOTIFICATION_TYPES,
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
};
