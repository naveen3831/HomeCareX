/** Smallest amount a partner can withdraw in one request (INR). */
export const MIN_WITHDRAWAL = 100;
/** Largest amount for one request (INR). A safety rail, not a balance rule. */
export const MAX_WITHDRAWAL = 200_000;
/** How many saved accounts one partner can keep. */
export const MAX_SAVED_ACCOUNTS = 5;

export const BANK_ACCOUNT_TYPES = ['bank', 'upi'] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

/**
 * pending  -> waiting for admin; the money is already held (taken out of the available balance)
 * approved -> admin accepted it and will transfer
 * paid     -> money sent, `transactionId` recorded
 * rejected / cancelled -> the held money went back to the wallet
 */
export const WITHDRAWAL_STATUSES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_REGEX = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
export const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;