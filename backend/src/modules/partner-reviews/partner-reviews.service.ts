import type { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { Errors } from '../../utils/errors';
import { buildSummary, maskAuthor } from '../reviews/reviews.service';
import { partnerReviewsRepository as repo, type PartnerReviewRow } from './partner-reviews.repository';
import type { PartnerReviewDto, PartnerReviewSummaryDto, PartnerReviewsResult } from './partner-reviews.types';

import { ensurePartnerProfile } from '../partners/partners.service';

/** The partner is always taken from the verified JWT. A client-supplied id is only checked against it, never used. */
async function resolvePartnerId(userId: string, requestedPartnerId?: string): Promise<Types.ObjectId> {
  let partner = await repo.findPartnerByUserId(userId);
  if (!partner) {
    try {
      await ensurePartnerProfile(userId);
      partner = await repo.findPartnerByUserId(userId);
    } catch {
      // ignore
    }
  }
  if (!partner) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
  const partnerId = partner._id as Types.ObjectId;
  if (requestedPartnerId && requestedPartnerId !== partnerId.toString()) throw Errors.notOwner();
  return partnerId;
}

export const toPartnerReview = (r: PartnerReviewRow, serviceName: string | null): PartnerReviewDto => ({
  id: String(r._id),
  rating: r.rating,
  comment: r.message ?? '',
  customer: maskAuthor(r.customerName),
  service: serviceName,
  tags: r.tags ?? [],
  verified: r.verified === true,
  createdAt: new Date(r.createdAt).toISOString(),
});

export const partnerReviewsService = {
  async getSummary(userId: string, requestedPartnerId?: string): Promise<PartnerReviewSummaryDto> {
    const partnerId = await resolvePartnerId(userId, requestedPartnerId);
    return buildSummary(await repo.starCounts(partnerId));
  },

  async list(
    userId: string,
    page: number,
    limit: number,
    requestedPartnerId?: string,
  ): Promise<PartnerReviewsResult> {
    const partnerId = await resolvePartnerId(userId, requestedPartnerId);
    const [total, rows] = await Promise.all([repo.countVisible(partnerId), repo.findVisible(partnerId, (page - 1) * limit, limit)]);

    const bookingIds = rows.flatMap((r) => (r.bookingId ? [r.bookingId] : []));
    const serviceIds = rows.flatMap((r) => (r.serviceId ? [r.serviceId] : []));
    const [byBooking, byService] = await Promise.all([repo.serviceNamesByBooking(bookingIds), repo.serviceNamesById(serviceIds)]);

    const reviews = rows.map((r) =>
      toPartnerReview(
        r,
        (r.bookingId && byBooking.get(String(r.bookingId))) || (r.serviceId && byService.get(String(r.serviceId))) || null,
      ),
    );
    return { reviews, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
