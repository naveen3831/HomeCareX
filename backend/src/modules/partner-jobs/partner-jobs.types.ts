import type { Types } from "mongoose";
import BookingModel, { type IBooking } from "../../models/Booking";
import PartnerModel from "../../models/Partner";
import ServiceModel from "../../models/Service";
import UserModel from "../../models/User";
import type { BookingStatus } from "../bookings/bookings.constants";
import type { StatusHistoryEntry } from "../bookings/bookings.stateMachine";

export interface JobActionDto {
  status: BookingStatus;
  label: string;
}

export interface JobRequestDto {
  id: string;
  service: string;
  area: string | null;
  address?: string;
  price: number;
  scheduledAt: string;
  /** null for a job the admin assigned directly: it has no response deadline. */
  expiresAt: string | null;
  /** true when the admin assigned this job to the partner (no open offer). */
  assignedByAdmin?: boolean;
}

export interface JobChecklistItemDto {
  id: string;
  label: string;
  done: boolean;
}

export interface JobAddOnDto {
  name: string;
  quantity: number;
  amount: number;
}

export interface JobListItemDto {
  id: string;
  status: BookingStatus;
  service: { name: string };
  customerName: string;
  address: string;
  scheduledAt: string;
  slot: string | null;
  partnerEarning: number;
  /** First service photo, or null when the service has none. */
  imageUrl: string | null;
  /** true once the partner accepted this job (an offer they took, or a job the admin assigned that they confirmed). */
  accepted: boolean;
}

export interface JobDetailDto {
  id: string;
  status: BookingStatus;
  accepted: boolean;
  customer: { name: string; phone: string | null };
  service: {
    name: string;
    quantity: number;
    durationMinutes: number | null;
  };
  location: {
    line1: string;
    area: string | null;
    city: string;
    pincode: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  schedule: {
    scheduledAt: string;
    date: string | null;
    slot: string | null;
    startedAt: string | null;
  };
  price: {
    currency: string;
    total: number;
    partnerEarning: number;
  };
  addOns: JobAddOnDto[];
  instructions: string | null;
  checklist: JobChecklistItemDto[];
  payment: {
    status: string;
    paidAt: string | null;
    /** "cash" or "upi" once the partner has collected it. */
    method: string | null;
    /** Service price plus approved extra charges: what the customer owes. */
    amountDue: number;
    /** upi://pay link for the QR code. Null when already paid or no UPI ID is configured. */
    upiUri: string | null;
  };
  /** The partner's rating of the customer, once given. */
  customerRating: { rating: number; comment: string | null } | null;
  actions: JobActionDto[];
  otpRequired: boolean;
  statusHistory: Array<{
    from: BookingStatus | null;
    to: BookingStatus;
    at: string;
    actorRole: string;
    actorId: string | null;
    reason: string | null;
  }>;
}

export interface JobBookingDoc {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  partnerId?: Types.ObjectId | null;
  serviceId?: Types.ObjectId;
  serviceName: string;
  customerName?: string;
  quantity: number;
  addOns: Array<{ addOnId: Types.ObjectId; quantity: number }>;
  address: {
    line1: string;
    area?: string | null;
    city: string;
    pincode?: string | null;
    location?: { coordinates?: number[] };
  };
  date?: string;
  slot?: string;
  scheduledAt: Date;
  startedAt?: Date;
  status: BookingStatus;
  statusHistory: IBooking["statusHistory"];
  priceSnapshot?: {
    currency?: string;
    lines?: Array<{
      kind: string;
      name: string;
      quantity: number;
      amount: number;
    }>;
  };
  priceBreakdown?: { total?: number };
  partnerEarning?: number;
  paymentStatus: string;
  paymentDetails?: { paidAt?: Date; method?: string };
  customerRating?: { rating?: number; comment?: string; ratedAt?: Date };
  instructions?: string;
  checklist?: Array<{ id: string; label: string; done: boolean }>;
}

export interface JobServiceDoc {
  durationMinutes?: number;
  inclusions?: string[];
  addOns?: Array<{ _id: Types.ObjectId; name: string; price: number }>;
}

export interface JobCustomerDoc {
  name?: string;
  phone?: string;
}

export const partnerJobsRepository = {
  findPartnerByUserId(userId: string) {
    return PartnerModel.findOne({ userId })
      .select("_id")
      .lean<{ _id: Types.ObjectId }>();
  },

  /** Live jobs of one partner, soonest first. */
  listLiveForPartner(
    partnerId: Types.ObjectId,
    statuses: BookingStatus[],
    limit = 50,
  ) {
    return BookingModel.find({ partnerId, status: { $in: statuses } })
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean<JobBookingDoc[]>();
  },

  findBooking(bookingId: string) {
    return BookingModel.findById(bookingId).lean<JobBookingDoc>();
  },

  findCustomer(customerId: Types.ObjectId) {
    return UserModel.findById(customerId)
      .select("name phone")
      .lean<JobCustomerDoc>();
  },

  findService(serviceId: Types.ObjectId) {
    return ServiceModel.findById(serviceId)
      .select("durationMinutes inclusions addOns")
      .lean<JobServiceDoc>();
  },

  /**
   * Atomic compare-and-set: only succeeds while the booking is still in `from` and still belongs to this
   * partner, so a double click or two devices can never apply the same step twice.
   */
  async transitionStatus(
    bookingId: string,
    partnerId: Types.ObjectId,
    from: BookingStatus,
    to: BookingStatus,
    entry: StatusHistoryEntry,
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      { _id: bookingId, partnerId, status: from },
      { $set: { status: to }, $push: { statusHistory: entry } },
    );
    return result.modifiedCount === 1;
  },
};