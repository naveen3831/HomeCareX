import type { JobAction, JobStatus } from './jobStatus';

/** Where the start OTP stands. Only sent while the partner has arrived and the job is not started yet. */
export interface StartVerification {
  maxAttempts: number;
  attemptsRemaining: number;
  /** ISO time after which the code stops working; null when the arrival time is unknown. */
  expiresAt: string | null;
  expired: boolean;
  /** true after too many wrong codes. Only support/admin can unlock it. */
  locked: boolean;
}

/**
 * UPI details the backend builds from UPI_PAYEE_ID / UPI_PAYEE_NAME.
 * Every field is optional on purpose: the screen copes with whatever subset arrives
 * (see normalizePayment() in jobDetails.mapper.ts).
 */
export interface ApiUpi {
  payeeId?: string | null;
  payeeName?: string | null;
  /** Rupees, as a number. */
  amount?: number | null;
  /** Transaction note shown in the customer's UPI app. */
  note?: string | null;
  /** Ready-made upi://pay?... link. If missing the page builds one from the fields above. */
  uri?: string | null;
}

export interface ApiPayment {
  status: string;
  paidAt?: string | null;
  method?: string | null;
  /** Amount due in rupees (job total plus approved extra charges), when the backend sends it. */
  amount?: number | null;
  /** What the backend actually sends: amount due, and a ready-made upi://pay link (null if no UPI ID is set). */
  amountDue?: number | null;
  upiUri?: string | null;
  upi?: ApiUpi | null;
}

/** Raw response of GET /partner/jobs/:id and PATCH /bookings/:id/status (the `data` field). */
export interface ApiJob {
  id: string;
  status: JobStatus;
  /** true once the partner accepted the job (the server keeps status "assigned" until they set off). */
  accepted?: boolean;
  customer: { name: string; phone: string | null };
  service: { name: string; description?: string | null; quantity: number; durationMinutes: number | null };
  location: {
    line1: string;
    area: string | null;
    city: string;
    pincode: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  schedule: { scheduledAt: string; date: string | null; slot: string | null; startedAt: string | null };
  price: { currency: string; total: number; partnerEarning: number };
  addOns: Array<{ name: string; quantity: number; amount: number }>;
  instructions: string | null;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  payment: ApiPayment;
  actions: JobAction[];
  otpRequired: boolean;
  startVerification?: StartVerification | null;
  extraCharges?: ExtraChargeItem[];
  statusHistory: Array<{
    from: JobStatus | null;
    to: JobStatus;
    at: string;
    actorRole: string;
    actorId: string | null;
    reason: string | null;
  }>;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobAddOn {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

export interface JobStatusEntry {
  status: JobStatus;
  at: string;
  actor: string;
}

export type ExtraChargeStatus = 'pending' | 'approved' | 'rejected';

export interface ExtraChargeItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  amount: number;
  reason?: string;
  status: ExtraChargeStatus;
  requestedAt?: string;
  decidedAt?: string;
}

export interface CompletionInput {
  otp?: string;
  photo?: File;
  notes?: string;
}

export type PaymentPhase = 'pending' | 'paid' | 'failed' | 'refunded';

export interface JobPaymentUpi {
  payeeId: string;
  payeeName: string;
  amount: number;
  note: string;
  /** upi://pay?... link, used for the QR code and the "Open UPI app" button. */
  uri: string;
}

export interface JobPayment {
  /** Raw status text from the backend (kept for older screens). */
  status: string;
  phase: PaymentPhase;
  amount: number;
  method?: string;
  paidAt?: string | null;
  /** null when the backend has no UPI payee configured or sent no details. */
  upi: JobPaymentUpi | null;
}

/** What the page renders. Built from ApiJob by mapJob() or local mock store. */
export interface JobDetails {
  id: string;
  bookingCode: string;
  status: JobStatus;
  customer: { name: string; phoneMasked: string; subtitle?: string };
  service: { name: string; description?: string | null; quantity: number; durationMinutes: number | null };
  location: {
    address: string;
    city: string;
    pincode: string | null;
    hint?: string;
    coordinates?: { lat: number; lng: number } | null;
  };
  schedule: {
    scheduledAt: string;
    dateLabel?: string;
    slot: string | null;
    startedAt: string | null;
    startedTimeLabel?: string;
    completedAt?: string | null;
  };
  price: { basePrice?: number; total: number; partnerEarning: number };
  addOns: JobAddOn[];
  extraCharges?: ExtraChargeItem[];
  instructions: string | null;
  checklist: JobChecklistItem[];
  payment: JobPayment;
  actions: JobAction[];
  otpRequired: boolean;
  startVerification?: StartVerification | null;
  otpVerified?: boolean;
  sosTriggeredAt?: string | null;
  history: JobStatusEntry[];
}