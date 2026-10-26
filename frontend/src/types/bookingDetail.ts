import type { BookingView } from "./booking";

/**
 * The customer-facing shape of ONE booking (GET /bookings/:id).
 * Mirrors what buildDetailView returns on the backend.
 */

/** Body of POST /bookings/:id/extra-charges/:chargeId/decision. */
export type ExtraChargeDecision = "approve" | "reject";

export type ExtraChargeStatus = "pending" | "approved" | "rejected";

export interface ExtraCharge {
  _id: string;
  title: string;
  reason?: string;
  amount: number;
  status: ExtraChargeStatus;
  requestedAt?: string;
  decidedAt?: string;
}

/** The assigned partner as a customer may see them. */
export interface BookingDetailPartner {
  name?: string;
  phone?: string;
  city?: string;
  rating?: number;
  ratingCount?: number;
  verified?: boolean;
  /** Profile photo URL. Shown on the tracking screen when the API provides it; otherwise the initial is used. */
  avatar?: string;
}

/** Catalog details of the booked service. */
export interface BookingDetailService {
  name?: string;
  description?: string;
  image?: string;
  durationMinutes?: number;
  categoryName?: string;
}

export interface BookingDetailPayment {
  orderId?: string;
  paymentId?: string;
  status?: string;
  paidAt?: string;
  method?: string;
  transactionId?: string;
}

export type BookingRefundStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "CREDITED"
  | "REJECTED"
  | "NOT_REQUIRED"
  | "PROCESSING"
  | "CREDIT_FAILED"
  | "requested"
  | "processed"
  | "rejected"
  | "none";

export interface BookingRefundInfo {
  refundId?: string;
  status: BookingRefundStatus;
  statusLabel?: string;
  amount?: number;
  originalPaidAmount?: number;
  destination?: string;
  requestedAt?: string;
  creditedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  walletTransactionRef?: string;
}

export interface BookingDetailView extends Omit<
  BookingView,
  "paymentDetails" | "otp"
> {
  /** Human-friendly reference when available. */
  bookingNumber?: string;
  serviceName?: string;
  cancellationReason?: string;

  /** Refund details when booking is cancelled or refund exists */
  refundStatus?: BookingRefundStatus;
  refund?: BookingRefundInfo | null;

  /** Only set while the partner has arrived; otherwise null. */
  startOtp: string | null;

  /** Null until a partner accepts. */
  partner: BookingDetailPartner | null;
  service: BookingDetailService | null;
  paymentDetails?: BookingDetailPayment;

  extraCharges: ExtraCharge[];

  /** Sum of approved extra charges added to the snapshot total. */
  extraChargesApprovedTotal: number;
}

/**
 * Cancellation preview returned by the backend.
 *
 * Important: feeAmount is the policy fee.
 * fee is the actual fee charged for this booking.
 */
export interface CancellationSummary {
  /** Free cancellation until this many hours before the slot. */
  windowHours: number;

  /** Flat cancellation fee configured in admin settings. */
  feeAmount: number;

  /** Hours remaining until the service slot. */
  hoursUntilSlot: number;

  /** Whether the booking qualifies for free cancellation. */
  freeCancellation: boolean;

  /** Fee actually kept from this booking. */
  fee: number;

  /** Amount the customer paid online. */
  paidAmount: number;

  /** Amount eligible for refund. */
  refundAmount: number;

  refundMethod: "RAZORPAY" | "WALLET" | null;

  refundStatus: "requested" | "PENDING_APPROVAL" | "none" | "NOT_REQUIRED";
}

/** POST /bookings/:id/cancel */
export interface CancelBookingResult {
  booking: BookingDetailView;
  cancellation: CancellationSummary;
}

/** POST /bookings/:id/reschedule */
export interface RescheduleInput {
  date: string;
  slot: string;
}
