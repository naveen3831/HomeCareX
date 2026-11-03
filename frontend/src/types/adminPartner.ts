/** Shapes returned by GET /admin/partners/:id (see partners.service.ts detail()). */
export type KycStatus =
  | "Approved"
  | "Pending"
  | "Rejected";

export type AccountStatus =
  | "Active"
  | "Inactive"
  | "Suspended";

export type KycDocumentStatus =
  | "Verified"
  | "Pending"
  | "Rejected";

export interface PartnerDocument {
  id: string;
  name: string;
  type: "image" | "pdf";
  /** Stored files: an API path under /admin (fetch it with the auth token). Otherwise a plain URL. */
  url: string;
  /** True when `url` is an authenticated API path rather than a public URL. */
  secure?: boolean;
  status: KycDocumentStatus;
}

/** Training submitted by the partner after KYC approval. "Not Submitted" = nothing uploaded yet. */
export type TrainingStatus =
  | "Not Submitted"
  | "Pending"
  | "Approved"
  | "Rejected";

export type TrainingItemStatus =
  | "Pending"
  | "Approved"
  | "Rejected";

export interface PartnerTrainingItem {
  id: string;
  /** e.g. "Safety training certificate", "Skill assessment" */
  name: string;
  type: "image" | "pdf";
  /** Same rule as PartnerDocument.url / secure. */
  url: string;
  secure?: boolean;
  status: TrainingItemStatus;
  submittedAt?: string;
}

export interface PartnerTraining {
  status: TrainingStatus;
  submittedAt?: string;
  reviewedAt?: string;
  /** Shown to the partner when status is Rejected. */
  rejectionReason?: string;
  items: PartnerTrainingItem[];
}

export interface KycItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
}

export interface PartnerBooking {
  id: string;
  customer: string;
  service: string;
  date: string;
  status: string;
  amount: number;
}

export interface PartnerReview {
  id: string;
  customer: string;
  rating: number;
  comment: string;
  date: string;
}

export interface PartnerActivity {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

export interface PartnerEarning {
  month: string;
  bookings: number;
  earnings: number;
}

export interface PartnerDetails {
  id: string;
  name: string;
  email: string;
  phone: string;

  kycStatus: KycStatus;
  accountStatus: AccountStatus;

  category: string;
  categories: string[];

  city: string;
  address: string;

  rating: number;
  acceptance: number;
  completion: number;

  joined: string;

  profile: {
    experience: number;
    bio: string;
  };

  kyc: {
    submittedAt: string;
    reviewedAt?: string;
    documents: PartnerDocument[];
    checklist: KycItem[];
  };

  performance: {
    completedBookings: number;
    cancelledBookings: number;
    averageResponseTime: string;
    customerSatisfaction: number;
  };

  bookings: PartnerBooking[];

  earnings: PartnerEarning[];

  payouts: {
    id: string;
    date: string;
    amount: number;
    status: string;
  }[];

  reviews: PartnerReview[];

  support: {
    ticketId: string;
    subject: string;
    status: string;
    createdAt: string;
  }[];

  activity: PartnerActivity[];

  /** Optional so an older backend that has no training data keeps working. */
  training?: PartnerTraining;
}