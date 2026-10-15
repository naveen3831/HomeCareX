import { Types } from 'mongoose';
import BookingModel from '../../models/Booking';
import PartnerModel from '../../models/Partner';
import ReviewModel from '../../models/Review';
import { ServiceModel } from '../../models/Service';

export interface PartnerReviewRow {
  _id: Types.ObjectId;
  rating: number;
  message?: string;
  customerName: string;
  tags?: string[];
  verified?: boolean;
  serviceId?: Types.ObjectId;
  bookingId?: Types.ObjectId;
  createdAt: Date;
}

const LIST_FIELDS = 'rating message customerName tags verified serviceId bookingId createdAt';

/**
 * Reviews the partner may see: theirs, not hidden by an admin and not rejected. This is the same rule
 * `recomputePartnerRating` uses, so this page always agrees with the rating shown on the Performance page.
 * Pure, so tests run this exact filter in memory.
 */
export const partnerReviewFilter = (partnerId: Types.ObjectId) => ({
  partnerId,
  visible: { $ne: false },
  status: { $ne: 'rejected' },
});

/** Newest first; `_id` breaks ties so pages never overlap or skip. */
export const PARTNER_REVIEW_SORT = { createdAt: -1, _id: -1 } as const;

/** Star -> count over the partner's visible reviews. */
export const partnerStarCountPipeline = (partnerId: Types.ObjectId) => [
  { $match: partnerReviewFilter(partnerId) },
  { $group: { _id: '$rating', count: { $sum: 1 } } },
];

/** Only layer that talks to Mongo for partner reviews. Tests swap these methods for in-memory versions. */
export const partnerReviewsRepository = {
  findPartnerByUserId(userId: string) {
    return PartnerModel.findOne({ userId }).select('_id').lean();
  },

  countVisible(partnerId: Types.ObjectId): Promise<number> {
    return ReviewModel.countDocuments(partnerReviewFilter(partnerId)).exec();
  },

  findVisible(partnerId: Types.ObjectId, skip: number, limit: number): Promise<PartnerReviewRow[]> {
    return ReviewModel.find(partnerReviewFilter(partnerId), LIST_FIELDS)
      .sort(PARTNER_REVIEW_SORT)
      .skip(skip)
      .limit(limit)
      .lean<PartnerReviewRow[]>()
      .exec();
  },

  /** One grouped query for the whole distribution (no per-star round trips). */
  async starCounts(partnerId: Types.ObjectId): Promise<Map<number, number>> {
    const rows = await ReviewModel.aggregate<{ _id: number; count: number }>(partnerStarCountPipeline(partnerId));
    return new Map(rows.map((r) => [r._id, r.count]));
  },

  /** Booking id -> the service name snapshot taken at booking time. */
  async serviceNamesByBooking(bookingIds: Types.ObjectId[]): Promise<Map<string, string>> {
    if (bookingIds.length === 0) return new Map();
    const rows = await BookingModel.find({ _id: { $in: bookingIds } }, 'serviceName')
      .lean<{ _id: Types.ObjectId; serviceName?: string }[]>()
      .exec();
    return new Map(rows.filter((r) => r.serviceName).map((r) => [String(r._id), r.serviceName as string]));
  },

  /** Service id -> current service name (fallback for reviews without a booking). */
  async serviceNamesById(serviceIds: Types.ObjectId[]): Promise<Map<string, string>> {
    if (serviceIds.length === 0) return new Map();
    const rows = await ServiceModel.find({ _id: { $in: serviceIds } }, 'name').lean<{ _id: Types.ObjectId; name: string }[]>().exec();
    return new Map(rows.map((r) => [String(r._id), r.name]));
  },
};
