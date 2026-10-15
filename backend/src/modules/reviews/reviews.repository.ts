import { Types } from 'mongoose';
import { BookingModel } from '../../models/Booking';
import { PartnerModel } from '../../models/Partner';
import { UserModel } from '../../models/User';
import { COMPLETED_STATUSES } from '../bookings/bookings.constants';
import { applyTransition } from '../bookings/bookings.stateMachine';
import { CategoryModel } from '../../models/Category';
import { ReviewModel } from '../../models/Review';
import { ServiceModel } from '../../models/Service';

export interface VisibleReviewRow {
  _id: Types.ObjectId;
  rating: number;
  message?: string;
  customerName: string;
  verified?: boolean;
  createdAt: Date;
}

export interface BookingForReview {
  customerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  partnerId?: Types.ObjectId | null;
  status: string;
}

/** A finished booking the customer has not reviewed yet. */
export interface PendingBookingRow {
  _id: Types.ObjectId;
  serviceId?: Types.ObjectId;
  serviceName: string;
  partnerId?: Types.ObjectId | null;
  scheduledAt: Date;
  date?: string;
}

export interface CustomerReviewRow {
  _id: Types.ObjectId;
  bookingId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  partnerId?: Types.ObjectId;
  rating: number;
  message?: string;
  tags?: string[];
  status: string;
  visible?: boolean;
  verified?: boolean;
  createdAt: Date;
}

const VISIBLE_FIELDS = 'rating message customerName verified createdAt';

/** Visible = approved, not hidden by an admin, and linked to this service. Pure, so tests run the exact same filter in memory. */
export const visibleReviewFilter = (serviceId: string) => ({ serviceId: new Types.ObjectId(serviceId), status: 'approved', visible: { $ne: false } });

/** Newest first; `_id` breaks ties so pages never overlap or skip. */
export const VISIBLE_REVIEW_SORT = { createdAt: -1, _id: -1 } as const;

/** Star -> count over the visible set. */
export const starCountPipeline = (serviceId: string) => [
  { $match: visibleReviewFilter(serviceId) },
  { $group: { _id: '$rating', count: { $sum: 1 } } },
];

/** Only layer that talks to Mongo for reviews. Tests swap these methods for in-memory versions. */
export class ReviewsRepository {
  /** True for an active service in an active category (the same rule GET /services/:slug uses for 404). */
  async isServiceVisible(serviceId: string): Promise<boolean> {
    const service = await ServiceModel.findOne({ _id: serviceId, active: { $ne: false } }, 'categoryId').lean<{ categoryId: Types.ObjectId }>().exec();
    if (!service) return false;
    return (await CategoryModel.exists({ _id: service.categoryId, active: { $ne: false } })) !== null;
  }

  findVisible(serviceId: string, skip: number, limit: number): Promise<VisibleReviewRow[]> {
    return ReviewModel.find(visibleReviewFilter(serviceId), VISIBLE_FIELDS)
      .sort(VISIBLE_REVIEW_SORT)
      .skip(skip)
      .limit(limit)
      .lean<VisibleReviewRow[]>()
      .exec();
  }

  /** Star -> count over the same visible set (one grouped query, no per-star round trips). */
  async starCounts(serviceId: string): Promise<Map<number, number>> {
    const rows = await ReviewModel.aggregate<{ _id: number; count: number }>(starCountPipeline(serviceId));
    return new Map(rows.map((r) => [r._id, r.count]));
  }

  findBookingForReview(bookingId: string): Promise<BookingForReview | null> {
    return BookingModel.findById(bookingId, 'customerId serviceId partnerId status').lean<BookingForReview>().exec();
  }

  /** True when this booking already has a review (the unique index is the real guard; this gives a clean 409 first). */
  async bookingHasReview(bookingId: string): Promise<boolean> {
    return (await ReviewModel.exists({ bookingId })) !== null;
  }

  /** The customer's own reviews, newest first. Always scoped by customerId. */
  listForCustomer(customerId: string): Promise<CustomerReviewRow[]> {
    return ReviewModel.find({ customerId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .lean<CustomerReviewRow[]>()
      .exec();
  }

  /** Completed bookings of this customer that have no review yet, most recent job first. */
  async listPendingForCustomer(customerId: string): Promise<PendingBookingRow[]> {
    const bookings = await BookingModel.find({ customerId, status: { $in: COMPLETED_STATUSES } }, 'serviceId serviceName partnerId scheduledAt date')
      .sort({ scheduledAt: -1, _id: -1 })
      .limit(200)
      .lean<PendingBookingRow[]>()
      .exec();
    if (bookings.length === 0) return [];
    const reviewed = new Set(
      (await ReviewModel.find({ bookingId: { $in: bookings.map((b) => b._id) } }, 'bookingId').lean<{ bookingId: Types.ObjectId }[]>().exec()).map((r) => String(r.bookingId)),
    );
    return bookings.filter((b) => !reviewed.has(String(b._id)));
  }

  /** Booking id -> the service name snapshot taken at booking time. */
  async serviceNames(bookingIds: Types.ObjectId[]): Promise<Map<string, string>> {
    if (bookingIds.length === 0) return new Map();
    const rows = await BookingModel.find({ _id: { $in: bookingIds } }, 'serviceName').lean<{ _id: Types.ObjectId; serviceName: string }[]>().exec();
    return new Map(rows.map((r) => [String(r._id), r.serviceName]));
  }

  /** Partner id -> display name (the partner's user name). */
  async partnerNames(partnerIds: Types.ObjectId[]): Promise<Map<string, string>> {
    if (partnerIds.length === 0) return new Map();
    const partners = await PartnerModel.find({ _id: { $in: partnerIds } }, 'userId').lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>().exec();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } }, 'name').lean<{ _id: Types.ObjectId; name: string }[]>().exec();
    const nameByUser = new Map(users.map((u) => [String(u._id), u.name]));
    return new Map(partners.map((p) => [String(p._id), nameByUser.get(String(p.userId)) ?? 'Your professional']));
  }

  /**
   * completed -> rated, with a status-history entry, so the booking shows it has been reviewed.
   * Only moves a booking that is exactly `completed`; anything else is left alone.
   */
  async markBookingRated(bookingId: string, customerId: string): Promise<void> {
    const booking = await BookingModel.findOne({ _id: bookingId, customerId, status: 'completed' });
    if (!booking) return;
    applyTransition(booking, 'rated', { role: 'customer', id: customerId }, 'Customer reviewed the service');
    await booking.save();
  }

  /** Recomputes Service.ratingAvg / ratingCount from the reviews the public page shows (approved and not hidden). */
  async recomputeServiceRating(serviceId: string): Promise<{ ratingAvg: number; ratingCount: number }> {
    const [row] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: visibleReviewFilter(serviceId) },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const ratingCount = row?.count ?? 0;
    const ratingAvg = ratingCount === 0 ? 0 : Math.round(row.avg * 10) / 10;
    await ServiceModel.updateOne({ _id: serviceId }, { $set: { ratingAvg, ratingCount } });
    return { ratingAvg, ratingCount };
  }

  /**
   * Recomputes Partner.ratingAvg / ratingCount from this partner's reviews. A review counts unless an
   * admin rejected or hid it. Pending reviews count straight away so the rating reflects the work done.
   */
  async recomputePartnerRating(partnerId: string): Promise<{ ratingAvg: number; ratingCount: number }> {
    const [row] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { partnerId: new Types.ObjectId(partnerId), status: { $ne: 'rejected' }, visible: { $ne: false } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const ratingCount = row?.count ?? 0;
    const ratingAvg = ratingCount === 0 ? 0 : Math.round(row.avg * 10) / 10;
    await PartnerModel.updateOne({ _id: partnerId }, { $set: { ratingAvg, ratingCount } });
    return { ratingAvg, ratingCount };
  }
}

export const reviewsRepository = new ReviewsRepository();
