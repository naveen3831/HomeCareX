import { Types } from "mongoose";
import BookingModel, { type IBooking } from "../../models/Booking";
import PartnerModel from "../../models/Partner";
import ServiceModel from "../../models/Service";
import UserModel from "../../models/User";
import type { BookingStatus } from "../bookings/bookings.constants";
import type { StatusHistoryEntry } from "../bookings/bookings.stateMachine";

export interface JobExtraCharge {
  _id: Types.ObjectId;
  title: string;
  reason?: string;
  amount: number;
  quantity: number;
  status: "pending" | "approved" | "rejected";
  requestedAt: Date;
  decidedAt?: Date;
}

export interface JobBookingDoc {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  partnerId?: Types.ObjectId | null;
  serviceId?: Types.ObjectId;
  serviceName: string;
  customerName?: string;
  quantity: number;
  addOns: Array<{
    addOnId: Types.ObjectId;
    quantity: number;
  }>;
  address: {
    line1: string;
    area?: string | null;
    city: string;
    pincode?: string | null;
    location?: {
      coordinates?: number[];
    };
  };
  date?: string;
  slot?: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
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
  priceBreakdown?: {
    total?: number;
  };
  partnerEarning?: number;
  paymentStatus: string;
  paymentDetails?: {
    paidAt?: Date;
    method?: string;
  };
  customerRating?: {
    rating?: number;
    comment?: string;
    ratedAt?: Date;
  };
  instructions?: string;
  checklist?: Array<{
    id: string;
    label: string;
    done: boolean;
  }>;
  otpCodes?: {
    start?: string;
    end?: string;
  };
  startOtpAttempts?: number;
  extraCharges?: JobExtraCharge[];
  offers?: Array<{
    partnerId: Types.ObjectId;
    offeredAt: Date;
    expiresAt: Date;
    response: "pending" | "accepted" | "rejected" | "expired";
    rejectReason?: string;
    respondedAt?: Date;
  }>;
}

export interface JobServiceDoc {
  durationMinutes?: number;
  inclusions?: string[];
  addOns?: Array<{
    _id: Types.ObjectId;
    name: string;
    price: number;
  }>;
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

  listLiveForPartner(
    partnerId: Types.ObjectId,
    statuses: BookingStatus[],
    limit = 50,
  ) {
    return BookingModel.find({
      partnerId,
      status: { $in: statuses },
    })
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

  /** First gallery photo per service, for the My Jobs cards. */
  findServiceMedia(serviceIds: Types.ObjectId[]) {
    return ServiceModel.find({ _id: { $in: serviceIds } })
      .select("media")
      .lean<Array<{ _id: Types.ObjectId; media?: Array<{ url: string }> }>>();
  },

  findJobRequests(
    partnerId: Types.ObjectId,
    now: Date = new Date(),
  ) {
    return BookingModel.find({
      status: "searching_for_partner",
      offers: {
        $elemMatch: {
          partnerId,
          response: "pending",
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
  ): Promise<"ACCEPTED" | "EXPIRED_OR_UNAVAILABLE" | "NOT_FOUND"> {
    const existing = await BookingModel.findById(bookingId)
      .select("status offers")
      .lean();

    if (!existing) {
      return "NOT_FOUND";
    }

    const entry: StatusHistoryEntry = {
      from: "searching_for_partner",
      to: "assigned",
      at: now,
      actorRole: "partner",
      actorId: userId,
      reason: "Offer accepted by partner",
    };

    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        status: "searching_for_partner",
        offers: {
          $elemMatch: {
            partnerId,
            response: "pending",
            expiresAt: { $gt: now },
          },
        },
      },
      {
        $set: {
          status: "assigned",
          partnerId,
          "offers.$[offer].response": "accepted",
          "offers.$[offer].respondedAt": now,
        },
        $push: {
          statusHistory: entry,
        },
      },
      {
        arrayFilters: [
          {
            "offer.partnerId": partnerId,
            "offer.response": "pending",
          },
        ],
      },
    );

    return result.modifiedCount === 1
      ? "ACCEPTED"
      : "EXPIRED_OR_UNAVAILABLE";
  },

  async rejectOffer(
    bookingId: string,
    partnerId: Types.ObjectId,
    reason?: string,
    now: Date = new Date(),
  ): Promise<"REJECTED" | "NOT_FOUND"> {
    const existing = await BookingModel.findById(bookingId)
      .select("status offers")
      .lean();

    if (!existing) {
      return "NOT_FOUND";
    }

    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        offers: {
          $elemMatch: {
            partnerId,
            response: "pending",
          },
        },
      },
      {
        $set: {
          "offers.$[offer].response": "rejected",
          "offers.$[offer].respondedAt": now,
          ...(reason ? { "offers.$[offer].rejectReason": reason } : {}),
        },
      },
      {
        arrayFilters: [
          {
            "offer.partnerId": partnerId,
            "offer.response": "pending",
          },
        ],
      },
    );

    return result.modifiedCount > 0 ? "REJECTED" : "NOT_FOUND";
  },

  async transitionStatus(
    bookingId: string,
    partnerId: Types.ObjectId,
    from: BookingStatus,
    to: BookingStatus,
    entry: StatusHistoryEntry,
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        partnerId,
        status: from,
      },
      {
        $set: {
          status: to,
        },
        $push: {
          statusHistory: entry,
        },
      },
    );

    return result.modifiedCount === 1;
  },

  /** The stored start code. It is `select: false` on the model, so it must be asked for explicitly. */
  async getStartOtp(bookingId: string): Promise<string | null> {
    const doc = (await BookingModel.findById(bookingId)
      .select("+otpCodes.start")
      .lean()
      .exec()) as { otpCodes?: { start?: string } } | null;

    return doc?.otpCodes?.start ?? null;
  },

  /** Counts one wrong try (atomic) and returns the new total. */
  async recordFailedStartAttempt(bookingId: string): Promise<number> {
    const doc = (await BookingModel.findByIdAndUpdate(
      bookingId,
      { $inc: { startOtpAttempts: 1 } },
      { new: true },
    )
      .select("startOtpAttempts")
      .lean()
      .exec()) as { startOtpAttempts?: number } | null;

    return doc?.startOtpAttempts ?? 0;
  },

  async verifyStartJob(
    bookingId: string,
    partnerId: Types.ObjectId,
    entry: StatusHistoryEntry,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        partnerId,
        status: "arrived",
      },
      {
        $set: {
          status: "in_progress",
          startedAt: now,
        },
        $push: {
          statusHistory: entry,
        },
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
      {
        _id: bookingId,
        partnerId,
        status: "in_progress",
      },
      {
        $set: {
          status: "completed",
          completedAt: now,
        },
        $push: {
          statusHistory: entry,
        },
      },
    );

    return result.modifiedCount === 1;
  },

  /** Marks a completed job as paid. Does nothing (returns false) if it is already paid. */
  async markPaid(
    bookingId: string,
    partnerId: Types.ObjectId,
    method: "cash" | "upi",
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        partnerId,
        status: { $in: ["completed", "rated"] },
        paymentStatus: { $ne: "PAID" },
      },
      {
        $set: {
          paymentStatus: "PAID",
          "paymentDetails.status": "PAID",
          "paymentDetails.paidAt": now,
          "paymentDetails.method": method,
          // cash: the partner holds the money (commission is cut from the wallet).
          // upi (QR): the customer paid the platform UPI id, so it follows the online-payment process.
          "paymentDetails.collectedBy": method === "cash" ? "partner" : "platform",
        },
      },
    );

    return result.modifiedCount === 1;
  },

  /** Saves the partner's rating of the customer. Only the first rating is kept. */
  async saveCustomerRating(
    bookingId: string,
    partnerId: Types.ObjectId,
    rating: number,
    comment: string | undefined,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        partnerId,
        status: { $in: ["completed", "rated"] },
        paymentStatus: "PAID",
        "customerRating.rating": { $exists: false },
      },
      {
        $set: {
          "customerRating.rating": rating,
          "customerRating.ratedAt": now,
          ...(comment ? { "customerRating.comment": comment } : {}),
        },
      },
    );

    return result.modifiedCount === 1;
  },

  async addExtraCharge(
    bookingId: string,
    partnerId: Types.ObjectId,
    charge: JobExtraCharge,
  ): Promise<boolean> {
    const filter = Types.ObjectId.isValid(bookingId)
      ? {
          _id: new Types.ObjectId(bookingId),
          partnerId,
          status: "in_progress",
        }
      : {
          _id: bookingId,
          partnerId,
          status: "in_progress",
        };

    const result = await BookingModel.updateOne(
      filter,
      {
        $push: {
          extraCharges: charge,
        },
      },
    );

    return result.modifiedCount === 1;
  },

  async updateChecklist(
    bookingId: string,
    partnerId: Types.ObjectId,
    checklist: Array<{
      id: string;
      label: string;
      done: boolean;
    }>,
  ): Promise<boolean> {
    const result = await BookingModel.updateOne(
      {
        _id: bookingId,
        partnerId,
        status: {
          $in: ["assigned", "en_route", "arrived", "in_progress"],
        },
      },
      {
        $set: {
          checklist,
        },
      },
    );

    return result.modifiedCount === 1;
  },
};