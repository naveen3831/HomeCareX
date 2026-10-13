export type BookingStatus =
  | "searching_for_partner"
  | "assigned"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "rated"
  | "cancelled_by_customer"
  | "cancelled_by_partner"
  | "cancelled_by_admin"
  | "no_show"
  | "disputed";

export interface JobActionDto {
  status: string;
  label: string;
}

export interface JobCustomer {
  name: string;
  phone: string | null;
}

export interface JobService {
  name: string;
  quantity: number;
  durationMinutes: number | null;
}

export interface JobLocation {
  line1: string;
  area?: string | null;
  city: string;
  pincode?: string | null;
  coordinates: { lat: number; lng: number } | null;
}

export interface JobSchedule {
  scheduledAt: string;
  date: string | null;
  slot: string | null;
  startedAt: string | null;
}

export interface JobPrice {
  currency: string;
  total: number;
  partnerEarning: number;
}

export interface JobAddon {
  id?: string;
  name: string;
  quantity: number;
  amount: number;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobPayment {
  status: string;
  paidAt: string | null;
}

export interface JobStatusHistoryEntry {
  from: string | null;
  to: string;
  at: string;
  actorRole: string;
  actorId: string | null;
  reason: string | null;
}

export interface ApiJob {
  id: string;
  status: BookingStatus;
  customer: JobCustomer;
  service: JobService;
  location: JobLocation;
  schedule: JobSchedule;
  price: JobPrice;
  addOns: JobAddon[];
  instructions: string | null;
  checklist: JobChecklistItem[];
  payment: JobPayment;
  actions: JobActionDto[];
  otpRequired: boolean;
  statusHistory: JobStatusHistoryEntry[];
}

export interface JobDetails {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  customer: { name: string; phoneMasked: string };
  service: { name: string; quantity: number; durationMinutes: number | null };
  location: {
    address: string;
    city: string;
    pincode: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  schedule: { scheduledAt: string; slot: string | null; startedAt: string | null };
  price: { total: number; partnerEarning: number; currency: string };
  payment: { status: string; amount: number };
  addOns: JobAddon[];
  instructions: string | null;
  checklist: JobChecklistItem[];
  actions: JobActionDto[];
  otpRequired: boolean;
  history: Array<{ status: string; at: string; actor: string }>;
}
