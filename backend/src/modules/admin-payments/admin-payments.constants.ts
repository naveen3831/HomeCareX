/** Finance permission required to read payments. The `admin` role has '*' so it passes automatically. */
export const PAYMENTS_READ = 'payments:read';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Date-only filters (YYYY-MM-DD) are interpreted in this offset (India). */
export const FILTER_UTC_OFFSET = '+05:30';