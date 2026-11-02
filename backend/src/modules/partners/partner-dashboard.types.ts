import type { KycDocumentStatus, KycDocumentType, KycStatus } from './partner-dashboard.constants';

/** Contract for the KYC module (Vaishnavi). Dates are ISO strings on the wire. */
export interface KycDocumentDto {
  id: string;
  type: KycDocumentType;
  url: string;
  status: KycDocumentStatus;
  reviewNote?: string;
  uploadedAt: string;
}

export interface KycDto {
  status: KycStatus;
  documents: KycDocumentDto[];
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  suspensionReason?: string;
}

export interface PartnerDto {
  id: string;
  userId: string;
  categories: string[];
  skills: string[];
  serviceRadiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  trainingCompleted: boolean;
  kyc: KycDto;
}

/** Body of "submit KYC" (partner -> not_started/rejected -> submitted). */
export interface SubmitKycInput {
  documents: { type: KycDocumentType; url: string; storageKey?: string }[];
}

/** Body of admin review actions (submitted -> in_review -> approved/rejected, approved <-> suspended). */
export interface ReviewKycInput {
  to: Extract<KycStatus, 'in_review' | 'approved' | 'rejected' | 'suspended'>;
  note?: string;
}
/** Job the partner is physically on right now. Dates are ISO strings on the wire. */
export interface ActiveJobDto {
  id: string;
  service: string;
  customer: string;
  address: string;
  status: 'en_route' | 'arrived' | 'in_progress';
  scheduledAt: string;
}

/** Response of GET /partner/dashboard (own data only). Rates are percentages 0-100, earnings are INR. */
export interface PartnerDashboardDto {
  newJobs: number;
  todayJobs: number;
  completedJobs: number;
  todayEarnings: number;
  rating: number;
  acceptanceRate: number;
  completionRate: number;
  activeJob: ActiveJobDto | null;
  /** Real money from the earnings ledger (what the Earnings page shows). INR. */
  earnings: { today: number; week: number; month: number; total: number; pending: number };
  /** Completed jobs of all time. */
  completedTotal: number;
  /** Real rates from bookings/offers; null means "no data yet" (not 0%). Rates are 0-100, rating 0-5. */
  performance: {
    rating: number | null;
    ratingCount: number;
    acceptanceRate: number | null;
    completionRate: number | null;
    onTimeRate: number | null;
  };
  /** Net earnings per day for the last 7 days, oldest first. date is YYYY-MM-DD in business time. */
  last7Days: Array<{ date: string; amount: number }>;
  assignedServices?: Array<{ id: string; name: string }>;
  categories?: string[];
}