export const NOTIFICATION_TOPICS = ['booking', 'payment', 'offers', 'reminders', 'support'] as const;
export const NOTIFICATION_CHANNELS = ['push', 'sms', 'email', 'inApp'] as const;
export const LANGUAGES = ['en', 'hi', 'te'] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type Language = (typeof LANGUAGES)[number];
export type NotificationMatrix = Record<NotificationTopic, Record<NotificationChannel, boolean>>;

export const DEFAULT_LANGUAGE: Language = 'en';

/** Offers are opt-in; everything else starts on, except SMS for offers/reminders to avoid surprise charges. */
export const DEFAULT_NOTIFICATIONS: NotificationMatrix = {
  booking: { push: true, sms: true, email: true, inApp: true },
  payment: { push: true, sms: true, email: true, inApp: true },
  offers: { push: false, sms: false, email: false, inApp: true },
  reminders: { push: true, sms: false, email: true, inApp: true },
  support: { push: true, sms: false, email: true, inApp: true },
};

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

/** Bookings that are still in flight: an account with any of these can't be deleted yet. */
export const OPEN_BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'created',
  'searching_for_partner',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'disputed',
] as const;
