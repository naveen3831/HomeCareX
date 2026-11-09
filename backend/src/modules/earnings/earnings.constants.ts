export const EARNING_STATUSES = ['pending', 'settled'] as const;
export type EarningStatus = (typeof EARNING_STATUSES)[number];

/**
 * How the money of a settled job moved:
 *   online    customer paid online before / during the service -> partner net credited to wallet, admin keeps commission
 *   upi_qr    cash-on-service job, but the customer paid the platform UPI by scanning the partner's QR -> same as online
 *   cod_cash  cash-on-service job, partner took the cash -> admin commission is DEBITED from the partner wallet
 */
export const SETTLEMENT_CHANNELS = ['online', 'upi_qr', 'cod_cash'] as const;
export type SettlementChannel = (typeof SETTLEMENT_CHANNELS)[number];

/** Used only when no Settings document exists yet. Override with DEFAULT_COMMISSION_RATE (e.g. 0.15). */
export const FALLBACK_COMMISSION_RATE = 0.2;