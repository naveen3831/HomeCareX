export const PAYOUTS_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MAX_PERIOD_DAYS: 366,
  BATCH_STATUSES: ['pending', 'processing', 'completed', 'failed'] as const,
  PAYOUT_STATUSES: ['pending', 'processing', 'paid', 'failed'] as const,
} as const;

export type PayoutBatchStatus =
  (typeof PAYOUTS_CONSTANTS.BATCH_STATUSES)[number];

export type PayoutStatus =
  (typeof PAYOUTS_CONSTANTS.PAYOUT_STATUSES)[number];
export const PAYOUT_BATCH_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const PAYOUTS_APPROVE = 'payouts:approve';
export const PAYOUTS_EXPORT = 'payouts:export';