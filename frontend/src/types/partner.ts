export interface ActiveJob {
  id: string;
  service: string;
  customer: string;
  address: string;
  status: "en_route" | "arrived" | "in_progress";
  scheduledAt: string;
}

/** GET /partner/dashboard */
export interface PartnerDashboard {
  newJobs: number;
  todayJobs: number;
  completedJobs: number;
  todayEarnings: number;
  rating: number;
  acceptanceRate: number;
  completionRate: number;
  activeJob: ActiveJob | null;
  /** Real money from the earnings ledger (same source as the Earnings page). INR. */
  earnings?: { today: number; week: number; month: number; total: number; pending: number };
  completedTotal?: number;
  /** Real rates; null = no data yet (show "No data", not 0%). */
  performance?: {
    rating: number | null;
    ratingCount: number;
    acceptanceRate: number | null;
    completionRate: number | null;
    onTimeRate: number | null;
  };
  /** Net earnings for each of the last 7 days, oldest first. */
  last7Days?: Array<{ date: string; amount: number }>;
  assignedServices?: Array<{ id: string; name: string }>;
}

/** A job offer waiting for the partner's accept/reject. */
export interface JobRequest {
  id: string;
  service: string;
  area: string;
  /** Full street address. Shown to the partner only after they accept. */
  address?: string;
  price: number;
  scheduledAt: string;
  /** ISO time after which the offer can no longer be accepted. null for a job the admin assigned directly (no deadline). */
  expiresAt: string | null;
  /** true when the admin assigned this job straight to the partner. */
  assignedByAdmin?: boolean;
}

export interface PartnerNotification {
  id: string;
  title: string;
  createdAt: string;
  read: boolean;
}

export interface EarningsSummary {
  today: number;
  week: number;
  month: number;
}

/* =========================================================
   P02 - Partner Jobs / My Jobs
   ========================================================= */

export type JobTab =
  | "all"
  | "requests"
  | "upcoming"
  | "active"
  | "completed"
  | "cancelled";

export type PartnerJobStatus =
  | "requested"
  | "upcoming"
  | "active"
  | "completed"
  | "cancelled";

export interface PartnerJob {
  id: string;
  bookingId: string;
  service: string;
  customer: string;
  location: string;
  distance: number;
  scheduledAt: string;
  amount: number;
  status: PartnerJobStatus;
  instructions?: string;
  expiresAt?: string;
  /** true when the admin assigned this job straight to the partner: no countdown, just accept or reject. */
  assignedByAdmin?: boolean;
  /** false while the partner has not accepted an assigned job yet. */
  accepted?: boolean;
  /** Service photo URL, when the backend sends one. */
  image?: string;
}

export interface JobsResponse {
  jobs: PartnerJob[];
  total: number;
  page: number;
  limit: number;
}

export interface JobMutationResult {
  success: boolean;
  message?: string;
}