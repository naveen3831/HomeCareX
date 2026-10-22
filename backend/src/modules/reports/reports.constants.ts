
export const REPORTS_CONSTANTS = {
  PERMISSION: 'reports:read',
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_PAGE: 1,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,

  COMPLETED_STATUSES: ['completed', 'rated'],

  CANCELLED_STATUSES: [
    'cancelled_by_customer',
    'cancelled_by_partner',
    'cancelled_by_admin',
  ],

  EXPORT_FILENAME_PREFIX: 'homecarex',
} as const;

export const REPORT_TYPES = [
  'bookings',
  'revenue',
  'partners',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
