/**
 * Settings contract. Every key the platform reads lives here with its default,
 * so getSetting() always has an answer even before the DB is seeded.
 */
export const SETTING_DEFAULTS = {
  /** GST charged on the service total, in percent. */
  'tax.gstPercent': { value: 18, description: 'GST percentage applied to bookings' },
  /** Platform commission taken from each completed job, in percent. */
  'commission.percent': { value: 20, description: 'Platform commission percentage on completed jobs' },
  /** Customer can cancel for free until this many hours before the slot. */
  'cancellation.windowHours': { value: 4, description: 'Free-cancellation window (hours before slot)' },
  /** Flat fee (INR) charged for cancellations inside the window. */
  'cancellation.feeAmount': { value: 99, description: 'Cancellation fee in INR inside the window' },
  /** Max bookings that can share one time slot for a service. */
  'slots.capacityPerSlot': { value: 5, description: 'Maximum bookings per time slot' },
  /** Pincodes where bookings are accepted (Hyderabad defaults). */
  'serviceability.pincodes': {
    value: [
      '500001', '500003', '500004', '500008', '500016', '500018', '500032', '500033',
      '500034', '500081', '500082', '500084', '500089', '500090',
    ] as string[],
    description: 'Serviceable pincodes',
  },
  /** Shown on invoices, emails and the customer app. */
  'business.name': { value: 'HomeCareX', description: 'Public business name' },
  'business.address': { value: '', description: 'Registered business address (printed on invoices)' },
  'support.email': { value: 'support@homecarex.in', description: 'Support email shown to customers and partners' },
  'support.phone': { value: '', description: 'Support phone number shown to customers and partners' },
  'support.hours': { value: '9 AM - 8 PM, all days', description: 'Support hours shown to customers' },
  /** Admin bell alerts. SOS alerts are never switched off. */
  'notifications.adminBookingAlerts': { value: true, description: 'Notify admins when a booking is created' },
  'notifications.adminTicketAlerts': { value: true, description: 'Notify admins when a support ticket is raised or gets a reply' },
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/** Value type per key, so getSetting('tax.gstPercent') is typed as number. */
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K]['value'];

// ---------------------------------------------------------------------------
// Page contract: what the admin Settings page renders and how each value is validated.
// ---------------------------------------------------------------------------

export const SETTING_SECTION_IDS = [
  'business',
  'pricing',
  'tax',
  'cancellation',
  'support',
  'booking',
  'slots',
  'notifications',
] as const;
export type SettingSectionId = (typeof SETTING_SECTION_IDS)[number];

export const SETTING_SECTION_LABELS: Record<SettingSectionId, { label: string; description: string }> = {
  business: { label: 'Business', description: 'Name and address used across the platform.' },
  pricing: { label: 'Pricing', description: 'Platform commission on completed jobs.' },
  tax: { label: 'Tax', description: 'Tax charged on bookings.' },
  cancellation: { label: 'Cancellation', description: 'Free-cancellation window and the fee after it.' },
  support: { label: 'Support', description: 'How customers and partners reach you.' },
  booking: { label: 'Booking', description: 'Where bookings are accepted.' },
  slots: { label: 'Slots', description: 'How many bookings one time slot can hold.' },
  notifications: { label: 'Notifications', description: 'Which events alert admins in the bell.' },
};

export type SettingType = 'number' | 'integer' | 'string' | 'boolean' | 'list';

export interface SettingMeta {
  section: SettingSectionId;
  label: string;
  type: SettingType;
  /** number / integer */
  min?: number;
  max?: number;
  /** string */
  maxLength?: number;
  /** string: an empty value is allowed */
  optional?: boolean;
  /** string / list items: format rule, with the message shown when it fails */
  format?: 'email' | 'phone' | 'pincode';
  /** Unit shown next to a number, e.g. '%', 'hours', 'INR'. */
  unit?: string;
}

export const SETTING_META: Record<SettingKey, SettingMeta> = {
  'business.name': { section: 'business', label: 'Business name', type: 'string', maxLength: 80 },
  'business.address': { section: 'business', label: 'Business address', type: 'string', maxLength: 200, optional: true },
  'commission.percent': { section: 'pricing', label: 'Platform commission', type: 'number', min: 0, max: 100, unit: '%' },
  'tax.gstPercent': { section: 'tax', label: 'GST', type: 'number', min: 0, max: 100, unit: '%' },
  'cancellation.windowHours': { section: 'cancellation', label: 'Free-cancellation window', type: 'integer', min: 0, max: 168, unit: 'hours' },
  'cancellation.feeAmount': { section: 'cancellation', label: 'Cancellation fee', type: 'number', min: 0, max: 10000, unit: 'INR' },
  'support.email': { section: 'support', label: 'Support email', type: 'string', maxLength: 120, format: 'email' },
  'support.phone': { section: 'support', label: 'Support phone', type: 'string', maxLength: 20, format: 'phone', optional: true },
  'support.hours': { section: 'support', label: 'Support hours', type: 'string', maxLength: 80 },
  'serviceability.pincodes': { section: 'booking', label: 'Serviceable pincodes', type: 'list', format: 'pincode' },
  'slots.capacityPerSlot': { section: 'slots', label: 'Bookings per slot', type: 'integer', min: 1, max: 50 },
  'notifications.adminBookingAlerts': { section: 'notifications', label: 'New booking alerts', type: 'boolean' },
  'notifications.adminTicketAlerts': { section: 'notifications', label: 'Ticket alerts (new + reply)', type: 'boolean' },
};

export const SETTINGS_AUDIT = { action: 'settings.updated', entity: 'Setting' } as const;
export const SETTINGS_MANAGE_PERMISSION = 'settings:manage';
