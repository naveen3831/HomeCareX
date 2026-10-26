import { Types } from "mongoose";
import BookingModel, { type IBooking } from "../../models/Booking";
import PartnerModel from "../../models/Partner";
import ServiceModel from "../../models/Service";
import UserModel from "../../models/User";
import type { BookingStatus } from "../bookings/bookings.constants";
import type { StatusHistoryEntry } from "../bookings/bookings.stateMachine";

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
  paymentDetails?: { paidAt?: Date };
  instructions?: string;
  checklist?: Array<{ id: string; label: string; done: boolean }>;
  extraCharges?: Array<{
    _id: Types.ObjectId;
    title: string;
    reason?: string;
    amount: number;
    quantity: number;
    status: "pending" | "approved" | "rejected";
    requestedAt?: Date;
    decidedAt?: Date;
  }>;
  otpCodes?: { start?: string; end?: string };
  offers?: Array<{
    partnerId: Types.ObjectId;
    offeredAt: Date;
    expiresAt: Date;
    response: 'pending' | 'accepted' | 'rejected' | 'expired';
  }>;
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

  findJobRequests(partnerId: Types.ObjectId, now: Date = new Date()) {
    return BookingModel.find({
      status: 'searching_for_partner',
      offers: {
        $elemMatch: {
          partnerId,
          response: 'pending',
          expiresAt: { $gt: now },
        },
      },
    })
      .sort({ scheduledAt: 1 })
      .lean<JobBookingDoc[]>();
  },

  async acceptOffer(
    bookingId: string,
    partnerId: Types.ObjectId,
    userId: string,
    now: Date = new Date(),
  ): Promise<'ACCEPTED' | 'EXPIRED_OR_UNAVAILABLE' | 'NOT_FOUND'> {
    const existing = await BookingModel.findById(bookingId).select('status offers').lean();
    if (!existing) return 'NOT_FOUND';

    const entry: StatusHistoryEntry = {
      from: 'searching_for_partner',
      to: 'assigned',
      at: now,
      actorRole: 'partner',
      actorId: userId,
      reason: 'Offer accepted by partner',
    };

    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        status: 'searching_for_partner',
        offers: {
          $elemMatch: {
            partnerId,
            response: 'pending',
            expiresAt: { $gt: now },
          },
        },
      },
      {
        $set: {
          status: 'assigned',
          partnerId,
          'offers.$[offer].response': 'accepted',
        },
        $push: { statusHistory: entry },
      },
      {
        arrayFilters: [{ 'offer.partnerId': partnerId }],
      },
    );

    if (result.modifiedCount === 1) {
      return 'ACCEPTED';
    }
    return 'EXPIRED_OR_UNAVAILABLE';
  },

  async rejectOffer(
    bookingId: string,
    partnerId: Types.ObjectId,
  ): Promise<'REJECTED' | 'NOT_FOUND'> {
    const existing = await BookingModel.findById(bookingId).select('status offers').lean();
    if (!existing) return 'NOT_FOUND';

    await BookingModel.updateOne(
      {
        _id: bookingId,
        'offers.partnerId': partnerId,
      },
      {
        $set: { 'offers.$[offer].response': 'rejected' },
      },
      {
        arrayFilters: [{ 'offer.partnerId': partnerId }],
      },
    );

    return 'REJECTED';
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

  async addExtraCharge(
    bookingId: string,
    partnerId: Types.ObjectId,
    charge: {
      _id: Types.ObjectId;
      title: string;
      reason?: string;
      amount: number;
      quantity: number;
      status: "pending";
      requestedAt: Date;
    },
  ): Promise<boolean> {
    const filter = Types.ObjectId.isValid(bookingId)
      ? { _id: new Types.ObjectId(bookingId), partnerId }
      : { _id: bookingId, partnerId };
    const result = await BookingModel.updateOne(
      filter,
      { $push: { extraCharges: charge } },
    );
    return result.modifiedCount === 1;
  },

  async updateChecklist(
    bookingId: string,
    partnerId: Types.ObjectId,
    checklist: Array<{ id: string; label: string; done: boolean }>,
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      { _id: bookingId, partnerId },
      { $set: { checklist } },
    );
    return result.modifiedCount === 1;
  },

  async verifyStartJob(
    bookingId: string,
    partnerId: Types.ObjectId,
    entry: StatusHistoryEntry,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      { _id: bookingId, partnerId, status: "arrived" },
      {
        $set: { status: "in_progress", startedAt: now },
        $push: { statusHistory: entry },
      },
    );
    return result.modifiedCount === 1;
  },

  async completePartnerJob(
    bookingId: string,
    partnerId: Types.ObjectId,
    entry: StatusHistoryEntry,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      { _id: bookingId, partnerId, status: "in_progress" },
      {
        $set: { status: "completed", completedAt: now },
        $push: { statusHistory: entry },
      },
    );
    return result.modifiedCount === 1;
  },
};
