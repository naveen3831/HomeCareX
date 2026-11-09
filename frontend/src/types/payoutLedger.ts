export type LedgerFrequency = 'daily' | 'weekly';

/** online = paid through the gateway, upi_qr = customer paid the platform UPI via the partner's QR, cod_cash = partner took cash. */
export type LedgerChannel = 'online' | 'upi_qr' | 'cod_cash';

export interface LedgerTotals {
  jobs: number;
  onlineJobs: number;
  qrJobs: number;
  cashJobs: number;
  gross: number;
  /** Commission the admin received. */
  adminReceived: number;
  /** Partner share credited to partner wallets (online + QR jobs). */
  partnerCredited: number;
  /** Admin commission cut from partner wallets (cash jobs). */
  partnerDebited: number;
  /** partnerCredited - partnerDebited */
  partnerNet: number;
}

export interface LedgerPeriod extends LedgerTotals {
  /** "YYYY-MM-DD", first day of the period (a Monday for weekly). */
  periodStart: string;
  /** "YYYY-MM-DD", last day of the period, inclusive. */
  periodEnd: string;
}

export interface LedgerReport {
  currency: 'INR';
  frequency: LedgerFrequency;
  from: string;
  to: string;
  totals: LedgerTotals;
  periods: LedgerPeriod[];
}

export interface LedgerLine {
  earningId: string;
  bookingId: string;
  bookingRef: string;
  serviceName: string;
  partnerId: string;
  partnerName: string;
  channel: LedgerChannel;
  gross: number;
  /** +commission the admin received. */
  adminAmount: number;
  /** +net credited to the partner wallet, or -commission debited from it (cash job). */
  partnerAmount: number;
  settledAt: string;
}

export interface LedgerLinesPage {
  items: LedgerLine[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
