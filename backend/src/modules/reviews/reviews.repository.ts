
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

/** Visible = approved, not hidden by an admin, and linked to this service. */
export const visibleReviewFilter = (serviceId: string) => ({
  serviceId: new Types.ObjectId(serviceId),
  status: 'approved',
  visible: { $ne: false },
});

/** Newest first; _id breaks ties so pages never overlap or skip. */
export const VISIBLE_REVIEW_SORT = {
  createdAt: -1,
  _id: -1,
} as const;

/** Star -> count over the same visible set. */
export const starCountPipeline = (serviceId: string) => [
  { $match: visibleReviewFilter(serviceId) },
  { $group: { _id: '$rating', count: { $sum: 1 } } },
];

/** Only layer that talks to Mongo for reviews. */
export class ReviewsRepository {
  /** True for an active service in an active category. */
  async isServiceVisible(serviceId: string): Promise<boolean> {
    const service = await ServiceModel.findOne(
      { _id: serviceId, active: { $ne: false } },
      'categoryId',
    )
      .lean<{ categoryId: Types.ObjectId }>()
      .exec();

    if (!service) return false;

    return (
      (await CategoryModel.exists({
        _id: service.categoryId,
        active: { $ne: false },
      })) !== null
    );
  }

  findVisible(
    serviceId: string,
    skip: number,
    limit: number,
  ): Promise<VisibleReviewRow[]> {
    return ReviewModel.find(visibleReviewFilter(serviceId), VISIBLE_FIELDS)
      .sort(VISIBLE_REVIEW_SORT)
      .skip(skip)
      .limit(limit)
      .lean<VisibleReviewRow[]>()
      .exec();
  }

  /** Star -> count over the same visible set. */
  async starCounts(serviceId: string): Promise<Map<number, number>> {
    const rows = await ReviewModel.aggregate<{
      _id: number;
      count: number;
    }>(starCountPipeline(serviceId));

    return new Map(rows.map((row) => [row._id, row.count]));
  }

  findBookingForReview(
    bookingId: string,
  ): Promise<BookingForReview | null> {
    return BookingModel.findById(
      bookingId,
      'customerId serviceId partnerId status',
    )
      .lean<BookingForReview>()
      .exec();
  }

  /** True when this booking already has a review. */
  async bookingHasReview(bookingId: string): Promise<boolean> {
    return (await ReviewModel.exists({ bookingId })) !== null;
  }

  /** The customer's own reviews, newest first. */
  listForCustomer(customerId: string): Promise<CustomerReviewRow[]> {
    return ReviewModel.find({ customerId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .lean<CustomerReviewRow[]>()
      .exec();
  }

  /** Completed bookings of this customer that have no review yet. */
  async listPendingForCustomer(
    customerId: string,
  ): Promise<PendingBookingRow[]> {
    const bookings = await BookingModel.find(
      {
        customerId,
        status: { $in: COMPLETED_STATUSES },
      },
      'serviceId serviceName partnerId scheduledAt date',
    )
      .sort({ scheduledAt: -1, _id: -1 })
      .limit(200)
      .lean<PendingBookingRow[]>()
      .exec();

    if (bookings.length === 0) return [];

    const reviewed = new Set(
      (
        await ReviewModel.find(
          { bookingId: { $in: bookings.map((booking) => booking._id) } },
          'bookingId',
        )
          .lean<{ bookingId: Types.ObjectId }[]>()
          .exec()
      ).map((review) => String(review.bookingId)),
    );

    return bookings.filter(
      (booking) => !reviewed.has(String(booking._id)),
    );
  }

  /** Booking ID -> service name snapshot taken at booking time. */
  async serviceNames(
    bookingIds: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    if (bookingIds.length === 0) return new Map();

    const rows = await BookingModel.find(
      { _id: { $in: bookingIds } },
      'serviceName',
    )
      .lean<{ _id: Types.ObjectId; serviceName: string }[]>()
      .exec();

    return new Map(
      rows.map((row) => [String(row._id), row.serviceName]),
    );
  }

  /**
   * Partner ID -> display name.
   * Temporary logs help identify missing Partner/User relationships.
   */
  async partnerNames(
    partnerIds: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    if (partnerIds.length === 0) {
      console.log('[Reviews] No partner IDs to resolve.');
      return new Map();
    }

    const uniquePartnerIds = [
      ...new Set(partnerIds.map((id) => String(id))),
    ].map((id) => new Types.ObjectId(id));

    const partners = await PartnerModel.find(
      { _id: { $in: uniquePartnerIds } },
      'userId',
    )
      .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>()
      .exec();

    console.log(
      '[Reviews] Requested partner IDs:',
      uniquePartnerIds.map(String),
    );

    console.log(
      '[Reviews] Matched partners:',
      partners.map((partner) => ({
        partnerId: String(partner._id),
        userId: partner.userId
          ? String(partner.userId)
          : null,
      })),
    );

    const userIds = partners
      .map((partner) => partner.userId)
      .filter(Boolean);

    const users = userIds.length
      ? await UserModel.find(
          { _id: { $in: userIds } },
          'name',
        )
          .lean<{ _id: Types.ObjectId; name: string }[]>()
          .exec()
      : [];

    console.log(
      '[Reviews] Matched users:',
      users.map((user) => ({
        userId: String(user._id),
        name: user.name,
      })),
    );

    const nameByUser = new Map(
      users.map((user) => [String(user._id), user.name]),
    );

    return new Map(
      partners.map((partner) => [
        String(partner._id),
        nameByUser.get(String(partner.userId)) ??
          'Your professional',
      ]),
    );
  }

  /** completed -> rated, with a status-history entry. */
  async markBookingRated(
    bookingId: string,
    customerId: string,
  ): Promise<void> {
    const booking = await BookingModel.findOne({
      _id: bookingId,
      customerId,
      status: 'completed',
    });

    if (!booking) return;

    applyTransition(
      booking,
      'rated',
      { role: 'customer', id: customerId },
      'Customer reviewed the service',
    );

    await booking.save();
  }

  /** Recomputes service ratings from approved, visible reviews. */
  async recomputeServiceRating(
    serviceId: string,
  ): Promise<{ ratingAvg: number; ratingCount: number }> {
    const [row] = await ReviewModel.aggregate<{
      avg: number;
      count: number;
    }>([
      { $match: visibleReviewFilter(serviceId) },
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingCount = row?.count ?? 0;
    const ratingAvg =
      ratingCount === 0 ? 0 : Math.round(row.avg * 10) / 10;

    await ServiceModel.updateOne(
      { _id: serviceId },
      { $set: { ratingAvg, ratingCount } },
    );

    return { ratingAvg, ratingCount };
  }

  /**
   * Recomputes partner ratings.
   * Pending reviews count unless rejected or hidden.
   */
  async recomputePartnerRating(
    partnerId: string,
  ): Promise<{ ratingAvg: number; ratingCount: number }> {
    const [row] = await ReviewModel.aggregate<{
      avg: number;
      count: number;
    }>([
      {
        $match: {
          partnerId: new Types.ObjectId(partnerId),
          status: { $ne: 'rejected' },
          visible: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingCount = row?.count ?? 0;
    const ratingAvg =
      ratingCount === 0 ? 0 : Math.round(row.avg * 10) / 10;

    await PartnerModel.updateOne(
      { _id: partnerId },
      { $set: { ratingAvg, ratingCount } },
    );

    return { ratingAvg, ratingCount };
  }
}

export const reviewsRepository = new ReviewsRepository();
