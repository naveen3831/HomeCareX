
import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { BookingModel } from '../../models/Booking';
import { ReviewModel } from '../../models/Review';
import { UserModel } from '../../models/User';
import { HttpError } from '../auth/auth.types';
import {
  COMPLETED_STATUSES,
  type BookingStatus,
} from '../bookings/bookings.constants';
import { auditService } from '../audit/audit.service';
import { STAR_VALUES } from './reviews.constants';
import {
  reviewsRepository,
  type CustomerReviewRow,
  type VisibleReviewRow,
} from './reviews.repository';
import type {
  CustomerReviewDto,
  PendingReviewDto,
  PublicReviewDto,
  ReviewSummaryDto,
  ServiceReviewsResult,
  StarDistribution,
} from './reviews.types';
import {
  adminReviewQuerySchema,
  bookingIdParamSchema,
  createBookingReviewSchema,
  createReviewSchema,
  reviewStatusSchema,
  reviewVisibilitySchema,
  serviceReviewsParamSchema,
  serviceReviewsQuerySchema,
  type ReviewStatus,
} from './reviews.validation';

/** "Ravi Kumar" -> "Ravi K."; customer email is never exposed publicly. */
interface ReviewAuditActor {
  id: string;
  ip: string;
}

/** "Ravi Kumar" -> "Ravi K."; a single name stays as is. The customer's email never leaves the server. */
export function maskAuthor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'Customer';
  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

const toPublicReview = (r: VisibleReviewRow): PublicReviewDto => ({
  id: String(r._id),
  rating: r.rating,
  comment: r.message ?? '',
  author: maskAuthor(r.customerName),
  verified: r.verified === true,
  createdAt: new Date(r.createdAt).toISOString(),
});

/** Zero-filled star distribution and one-decimal average. */
export function buildSummary(
  counts: Map<number, number>,
): ReviewSummaryDto {
  const distribution: StarDistribution = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };

  let count = 0;
  let sum = 0;

  for (const star of STAR_VALUES) {
    const n = counts.get(star) ?? 0;
    distribution[String(star) as keyof StarDistribution] = n;
    count += n;
    sum += n * star;
  }

  return {
    average:
      count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
    count,
    distribution,
  };
}

const isDuplicateKey = (err: unknown): boolean =>
  (err as { code?: number })?.code === 11000;

const idOrNull = (value: unknown): string | null =>
  value ? String(value) : null;

const toCustomerReviewDto = (
  r: CustomerReviewRow,
  serviceName: string | null,
  partnerName: string | null,
): CustomerReviewDto => ({
  id: String(r._id),
  bookingId: idOrNull(r.bookingId),
  serviceId: idOrNull(r.serviceId),
  serviceName,
  partnerId: idOrNull(r.partnerId),
  partnerName,
  rating: r.rating,
  comment: r.message ?? '',
  tags: r.tags ?? [],
  status: r.status as CustomerReviewDto['status'],
  visible: r.visible !== false,
  verified: r.verified === true,
  createdAt: new Date(r.createdAt).toISOString(),
});

export class ReviewsService {
  /**
   * Fail-safe audit helper. A logging failure must not make a successful review
   * status change fail for the admin.
   */
  private async recordReviewAudit(
    action: string,
    reviewId: string,
    actor: ReviewAuditActor,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    try {
      await auditService.recordAudit({
        actor: actor.id,
        action,
        entity: 'Review',
        entityId: reviewId,
        ip: actor.ip || 'unknown',
        result: 'Success',
        before,
        after,
      });
    } catch (error) {
      console.error('[Audit] Failed to record review action:', error);
    }
  }

  async createReview(customerId: string, input: unknown) {
    const parsed = createReviewSchema.safeParse(input);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? 'Invalid review',
        'VALIDATION_ERROR',
      );
    }

    if (!Types.ObjectId.isValid(customerId)) {
      throw new HttpError(
        401,
        'Authentication required',
        'NO_ACCESS_TOKEN',
      );
    }

    const customer = await UserModel.findById(customerId)
      .select('name email')
      .lean();

    if (!customer) {
      throw new HttpError(404, 'Customer not found', 'NOT_FOUND');
    }

    const link = await this.resolveServiceLink(
      customerId,
      parsed.data.serviceId,
      parsed.data.bookingId,
    );

    try {
      const review = await ReviewModel.create({
        customerId: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        rating: parsed.data.rating,
        message: parsed.data.message,
        ...link,
      });

      return review.toObject();
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new HttpError(
          409,
          'You have already reviewed this booking',
          ERROR_CODES.CONFLICT,
        );
      }

      throw err;
    }
  }

  /**
   * POST /bookings/:id/review
   * A customer may review only their own completed booking, once.
   */
  async createBookingReview(
    customerId: string,
    bookingId: unknown,
    input: unknown,
  ): Promise<CustomerReviewDto> {
    const idParsed = bookingIdParamSchema.safeParse({
      id: bookingId,
    });

    if (!idParsed.success) {
      throw new HttpError(
        400,
        idParsed.error.issues[0]?.message ?? 'Invalid booking id',
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const parsed = createBookingReviewSchema.safeParse(input ?? {});

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? 'Invalid review',
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!Types.ObjectId.isValid(customerId)) {
      throw new HttpError(
        401,
        'Authentication required',
        ERROR_CODES.NO_ACCESS_TOKEN,
      );
    }

    const id = idParsed.data.id;
    const booking = await reviewsRepository.findBookingForReview(id);

    if (!booking || String(booking.customerId) !== customerId) {
      throw new HttpError(
        404,
        'Booking not found',
        ERROR_CODES.BOOKING_NOT_FOUND,
      );
    }

    if (!COMPLETED_STATUSES.includes(booking.status as BookingStatus)) {
      throw new HttpError(
        409,
        'You can review a booking once it is completed',
        ERROR_CODES.CONFLICT,
      );
    }

    if (await reviewsRepository.bookingHasReview(id)) {
      throw new HttpError(
        409,
        'You have already reviewed this booking',
        ERROR_CODES.CONFLICT,
      );
    }

    const customer = await UserModel.findById(customerId)
      .select('name email')
      .lean();

    if (!customer) {
      throw new HttpError(
        404,
        'Customer not found',
        ERROR_CODES.CUSTOMER_NOT_FOUND,
      );
    }

    let review;

    try {
      review = await ReviewModel.create({
        customerId: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        rating: parsed.data.rating,
        message: parsed.data.comment,
        tags: parsed.data.tags,
        bookingId: new Types.ObjectId(id),
        ...(booking.serviceId
          ? { serviceId: booking.serviceId }
          : {}),
        ...(booking.partnerId
          ? { partnerId: booking.partnerId }
          : {}),
        verified: true,
      });
      const saved = review.toObject ? review.toObject() : review;
      saved.status = 'approved';
      saved.visible = true;
      review = { ...review, toObject: () => saved } as typeof review;
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new HttpError(
          409,
          'You have already reviewed this booking',
          ERROR_CODES.CONFLICT,
        );
      }

      throw err;
    }

    // Log follow-up failures without failing the saved review.
    try {
      await reviewsRepository.markBookingRated(id, customerId);

      if (booking.partnerId) {
        await reviewsRepository.recomputePartnerRating(
          String(booking.partnerId),
        );
      }

      if (booking.serviceId) {
        await reviewsRepository.recomputeServiceRating(
          String(booking.serviceId),
        );
      }
    } catch (err) {
      console.error(
        'Review saved, but the booking/partner follow-up failed:',
        err,
      );
    }

    const [serviceNames, partnerNames] = await Promise.all([
      reviewsRepository.serviceNames([new Types.ObjectId(id)]),
      booking.partnerId
        ? reviewsRepository.partnerNames([booking.partnerId])
        : Promise.resolve(new Map<string, string>()),
    ]);

    return toCustomerReviewDto(
      review.toObject() as unknown as CustomerReviewRow,
      serviceNames.get(id) ?? null,
      booking.partnerId
        ? partnerNames.get(String(booking.partnerId)) ?? null
        : null,
    );
  }

  /** GET /reviews — signed-in customer's reviews. */
  async listMyReviews(
    customerId: string,
  ): Promise<CustomerReviewDto[]> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new HttpError(
        401,
        'Authentication required',
        'NO_ACCESS_TOKEN',
      );
    }

    const rows = await reviewsRepository.listForCustomer(customerId);

    const bookingIds = rows.flatMap((r) =>
      r.bookingId ? [r.bookingId] : [],
    );

    const partnerIds = rows.flatMap((r) =>
      r.partnerId ? [r.partnerId] : [],
    );

    const [serviceNames, partnerNames] = await Promise.all([
      reviewsRepository.serviceNames(bookingIds),
      reviewsRepository.partnerNames(partnerIds),
    ]);

    return rows.map((r) =>
      toCustomerReviewDto(
        r,
        r.bookingId
          ? serviceNames.get(String(r.bookingId)) ?? null
          : null,
        r.partnerId
          ? partnerNames.get(String(r.partnerId)) ?? null
          : null,
      ),
    );
  }

  /** GET /reviews/pending — completed bookings not reviewed yet. */
  async listPendingReviews(
    customerId: string,
  ): Promise<PendingReviewDto[]> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new HttpError(
        401,
        'Authentication required',
        ERROR_CODES.NO_ACCESS_TOKEN,
      );
    }

    const rows =
      await reviewsRepository.listPendingForCustomer(customerId);

    const partnerNames = await reviewsRepository.partnerNames(
      rows.flatMap((b) => (b.partnerId ? [b.partnerId] : [])),
    );

    return rows.map((b) => ({
      bookingId: String(b._id),
      serviceId: idOrNull(b.serviceId),
      serviceName: b.serviceName,
      partnerId: idOrNull(b.partnerId),
      partnerName: b.partnerId
        ? partnerNames.get(String(b.partnerId)) ?? null
        : null,
      completedOn: new Date(b.scheduledAt).toISOString(),
    }));
  }

  /**
   * Resolves the service/booking relationship.
   * A verified review must belong to this customer and a completed booking.
   */
  private async resolveServiceLink(
    customerId: string,
    serviceId?: string,
    bookingId?: string,
  ) {
    if (!serviceId) return {};

    if (!bookingId) {
      return {
        serviceId: new Types.ObjectId(serviceId),
        verified: false,
      };
    }

    const booking =
      await reviewsRepository.findBookingForReview(bookingId);

    if (!booking || String(booking.customerId) !== customerId) {
      throw new HttpError(
        404,
        'Booking not found',
        ERROR_CODES.BOOKING_NOT_FOUND,
      );
    }

    if (
      !booking.serviceId ||
      String(booking.serviceId) !== serviceId
    ) {
      throw new HttpError(
        400,
        'This booking is not for that service',
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!COMPLETED_STATUSES.includes(booking.status as BookingStatus)) {
      throw new HttpError(
        409,
        'You can review a service once the booking is completed',
        ERROR_CODES.CONFLICT,
      );
    }

    return {
      serviceId: new Types.ObjectId(serviceId),
      bookingId: new Types.ObjectId(bookingId),
      verified: true,
    };
  }

  /** GET /services/:id/reviews — public, approved, visible reviews. */
  async listServiceReviews(
    params: unknown,
    query: unknown,
  ): Promise<ServiceReviewsResult> {
    const { id } = serviceReviewsParamSchema.parse(params);
    const { page, limit } = serviceReviewsQuerySchema.parse(query);

    if (!(await reviewsRepository.isServiceVisible(id))) {
      throw new HttpError(
        404,
        'Service not found',
        ERROR_CODES.NOT_FOUND,
      );
    }

    const [counts, rows] = await Promise.all([
      reviewsRepository.starCounts(id),
      reviewsRepository.findVisible(
        id,
        (page - 1) * limit,
        limit,
      ),
    ]);

    const summary = buildSummary(counts);

    return {
      summary,
      reviews: rows.map(toPublicReview),
      meta: {
        page,
        limit,
        total: summary.count,
        totalPages: Math.ceil(summary.count / limit),
      },
    };
  }

  /** GET /reviews/mine — legacy customer review endpoint. */
  async listCustomerReviews(customerId: string) {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new HttpError(
        401,
        'Authentication required',
        'NO_ACCESS_TOKEN',
      );
    }

    return ReviewModel.find({ customerId })
      .sort({ createdAt: -1 })
      .lean();
  }

  /** GET /admin/reviews — list and filter reviews. */
  async listAdminReviews(query: unknown) {
    const parsed = adminReviewQuerySchema.safeParse(query);

    if (!parsed.success) {
      throw new HttpError(
        400,
        'Invalid review filters',
        'VALIDATION_ERROR',
      );
    }

    const { page, limit, search, status } = parsed.data;
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');

      filter.$or = [
        { customerName: expression },
        { customerEmail: expression },
        { message: expression },
      ];
    }

    const [
      reviews,
      total,
      pending,
      approved,
      rejected,
      allReviews,
    ] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(filter),
      ReviewModel.countDocuments({ status: 'pending' }),
      ReviewModel.countDocuments({ status: 'approved' }),
      ReviewModel.countDocuments({ status: 'rejected' }),
      ReviewModel.countDocuments(),
    ]);

    // DEMO ONLY: mock names are displayed only when real names are unavailable.

    // Collect booking IDs for reviews without a stored partner ID.
    const bookingIds = [
      ...new Set(
        reviews
          .filter((review) => !review.partnerId && review.bookingId)
          .map((review) => String(review.bookingId))
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];

    const bookings = bookingIds.length
      ? await BookingModel.find({
          _id: {
            $in: bookingIds.map((id) => new Types.ObjectId(id)),
          },
        })
          .select('_id partnerId offers')
          .lean()
      : [];

    // Resolve booking-to-partner mappings.
    const bookingPartnerMap = new Map<string, string>();

    for (const booking of bookings) {
      let partnerId = booking.partnerId
        ? String(booking.partnerId)
        : null;

      // Use an accepted offer only if exactly one valid partner is identified.
      if (!partnerId) {
        const acceptedOffers = (booking.offers ?? []).filter(
          (offer) =>
            offer.response === 'accepted' &&
            offer.partnerId &&
            Types.ObjectId.isValid(String(offer.partnerId)),
        );

        if (acceptedOffers.length === 1) {
          partnerId = String(acceptedOffers[0].partnerId);
        }
      }

      if (partnerId && Types.ObjectId.isValid(partnerId)) {
        bookingPartnerMap.set(String(booking._id), partnerId);
      }
    }

    // Gather real partner IDs from reviews and their bookings.
    const partnerIds = [
      ...new Set(
        reviews.flatMap((review) => {
          const partnerId =
            (review.partnerId
              ? String(review.partnerId)
              : undefined) ??
            (review.bookingId
              ? bookingPartnerMap.get(String(review.bookingId))
              : undefined);

          return partnerId && Types.ObjectId.isValid(partnerId)
            ? [partnerId]
            : [];
        }),
      ),
    ];

    const partnerNames = await reviewsRepository.partnerNames(
      partnerIds.map((id) => new Types.ObjectId(id)),
    );

    // Return real partner names; null when the review has no assigned partner.
    const enrichedReviews = reviews.map((review) => {
      const partnerId =
        (review.partnerId
          ? String(review.partnerId)
          : undefined) ??
        (review.bookingId
          ? bookingPartnerMap.get(String(review.bookingId))
          : undefined);

      const realPartnerName = partnerId
        ? partnerNames.get(partnerId) ?? null
        : null;

      // Real partner only. No placeholder names: an unassigned review shows no partner.
      const partnerName = realPartnerName;

      return {
        ...review,
        partnerId: partnerId ?? null,
        partnerName,
      };
    });

    return {
      reviews: enrichedReviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total: allReviews,
        pending,
        approved,
        rejected,
      },
    };
  }

  /** PATCH /admin/reviews/:id/visibility — hide or restore a review. */
  async updateReviewVisibility(
    id: string,
    visible: unknown,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        400,
        'Invalid review ID',
        'INVALID_ID',
      );
    }

    const parsed = reviewVisibilitySchema.safeParse({ visible });

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ??
          'Invalid visibility value',
        'VALIDATION_ERROR',
      );
    }

    const existingReview = await ReviewModel.findById(id).lean();

    if (!existingReview) {
      throw new HttpError(
        404,
        'Review not found',
        'NOT_FOUND',
      );
    }

    const review = await ReviewModel.findByIdAndUpdate(
      id,
      {
        $set: {
          visible: parsed.data.visible,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!review) {
      throw new HttpError(
        404,
        'Review not found',
        'NOT_FOUND',
      );
    }

    // Recalculate ratings after hiding or restoring a review.
    if (review.partnerId) {
      await reviewsRepository.recomputePartnerRating(
        String(review.partnerId),
      );
    }

    if (review.serviceId) {
      await reviewsRepository.recomputeServiceRating(
        String(review.serviceId),
      );
    }

    return review;
  }

  async updateReviewStatus(
    id: string,
    status: unknown,
    actor: ReviewAuditActor,
  ) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid review ID', 'INVALID_ID');
    const parsedStatus = reviewStatusSchema.safeParse(status);
    if (!parsedStatus.success) throw new HttpError(400, 'Invalid review status', 'VALIDATION_ERROR');

    // Read first so the audit entry contains the actual previous status.
    const existingReview = await ReviewModel.findById(id).select('_id status').lean();
    if (!existingReview) throw new HttpError(404, 'Review not found', 'NOT_FOUND');

    const previousStatus = existingReview.status;
    const nextStatus = parsedStatus.data as ReviewStatus;

    const review = await ReviewModel.findByIdAndUpdate(
      id,
      { $set: { status: nextStatus } },
      { new: true, runValidators: true },
    ).lean();

    if (!review) throw new HttpError(404, 'Review not found', 'NOT_FOUND');

    if (review.partnerId) {
      await reviewsRepository.recomputePartnerRating(String(review.partnerId));
    }
    if (review.serviceId) {
      await reviewsRepository.recomputeServiceRating(String(review.serviceId));
    }

    // Only record after the update succeeds.
    await this.recordReviewAudit(
      'review.status_updated',
      String(review._id),
      actor,
      { status: previousStatus },
      { status: review.status },
    );

    return review;
  }
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
