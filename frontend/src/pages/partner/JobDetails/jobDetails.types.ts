import type { JobAction, JobStatus } from './jobStatus';

/** Raw response of GET /partner/jobs/:id and PATCH /bookings/:id/status (the `data` field). */
export interface ApiJob {
  id: string;
  status: JobStatus;
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
  payment: { status: string; paidAt: string | null };
  actions: JobAction[];
  otpRequired: boolean;
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

/** What the page renders. Built from ApiJob by mapJob() or local mock store. */
export interface JobDetails {
  id: string;
  bookingCode: string;
  status: JobStatus;
  customer: { name: string; phoneMasked: string; subtitle?: string };
  service: { name: string; description?: string | null; quantity: number; durationMinutes: number | null };
  location: { address: string; city: string; pincode: string | null; hint?: string };
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
  instructions: string | null;
  checklist: JobChecklistItem[];
  payment: { status: string; amount: number; method?: string };
  actions: JobAction[];
  otpRequired: boolean;
  otpVerified?: boolean;
  sosTriggeredAt?: string | null;
  history: JobStatusEntry[];
}