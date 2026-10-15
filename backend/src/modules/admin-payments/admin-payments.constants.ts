/** Finance permission required to read payments. The `admin` role has '*' so it passes automatically. */
export const PAYMENTS_READ = 'payments:read';

/**
 * Finance permission required to issue or decide a refund / wallet credit (POST|PATCH /admin/refunds).
 * Deliberately separate from `tickets:manage`: a support agent can work a ticket without being able to move money.
 */
export const PAYMENTS_REFUND = 'payments:refund';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Date-only filters (YYYY-MM-DD) are interpreted in this offset (India). */
export const FILTER_UTC_OFFSET = '+05:30';