/** A job counts toward the scorecard once it has a final outcome for this partner. */
export const COMPLETED_JOB_STATUSES = ['completed', 'rated'] as const;
export const CANCELLED_BY_PARTNER_STATUS = 'cancelled_by_partner';
export const NO_SHOW_STATUS = 'no_show';

/**
 * Jobs with a final result: completed, cancelled by the partner, or no-show.
 * Customer/admin cancellations are not the partner's doing, so they are left out of every rate.
 */
export const RESOLVED_JOB_STATUSES = [...COMPLETED_JOB_STATUSES, CANCELLED_BY_PARTNER_STATUS, NO_SHOW_STATUS] as const;

/** Offer responses that count as "received" for the acceptance rate (a still-pending offer does not count against the partner). */
export const ANSWERED_OFFER_RESPONSES = ['accepted', 'rejected', 'expired'] as const;

/** Arriving up to this many minutes after the slot start still counts as on time. Confirm the value with your lead. */
export const ON_TIME_GRACE_MINUTES = 10;

/** Months shown on the trends chart, including the current one. */
export const TREND_MONTHS = 6;