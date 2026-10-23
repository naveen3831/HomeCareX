
export const PAYOUTS_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  BATCH_STATUSES: ['pending', 'processing', 'completed', 'failed'] as const,
  PAYOUT_STATUSES: ['pending', 'processing', 'paid', 'failed'] as const,
} as const;

export type PayoutBatchStatus =
  (typeof PAYOUTS_CONSTANTS.BATCH_STATUSES)[number];

export type PayoutStatus =
  (typeof PAYOUTS_CONSTANTS.PAYOUT_STATUSES)[number];
