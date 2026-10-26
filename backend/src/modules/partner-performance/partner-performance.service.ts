import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { businessTzOffsetMinutes, parseLocalDate } from '../../utils/dates';
import { Errors } from '../../utils/errors';
import { EMPTY_JOBS, EMPTY_OFFERS, buildPoint, buildSummary, lastMonths } from './partner-performance.calc';
import { TREND_MONTHS } from './partner-performance.constants';
import { partnerPerformanceRepository as repo } from './partner-performance.repository';
import type { PerformanceSummaryDto, PerformanceTrendsDto } from './partner-performance.types';

import { ensurePartnerProfile } from '../partners/partners.service';

/** The partner is always taken from the verified JWT. A client-supplied id is only checked against it, never used. */
async function resolvePartnerId(userId: string, requestedPartnerId?: string) {
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
  return { partner, partnerId };
}

export const partnerPerformanceService = {
  async getSummary(userId: string, requestedPartnerId?: string): Promise<PerformanceSummaryDto> {
    const { partner, partnerId } = await resolvePartnerId(userId, requestedPartnerId);
    const offset = businessTzOffsetMinutes();
    const [jobs, offers] = await Promise.all([
      repo.jobCounts(partnerId, 'all', offset),
      repo.offerCounts(partnerId, 'all', offset),
    ]);
    return buildSummary(partner, jobs.get('all') ?? EMPTY_JOBS, offers.get('all') ?? EMPTY_OFFERS);
  },

  /** One point per month for the last TREND_MONTHS months, oldest first; months with no activity are null, not zero. */
  async getTrends(userId: string, requestedPartnerId?: string, now: Date = new Date()): Promise<PerformanceTrendsDto> {
    const { partnerId } = await resolvePartnerId(userId, requestedPartnerId);
    const offset = businessTzOffsetMinutes();
    const periods = lastMonths(now, TREND_MONTHS, offset);
    const from = parseLocalDate(`${periods[0]}-01`, offset);

    const [jobs, offers, ratings] = await Promise.all([
      repo.jobCounts(partnerId, 'month', offset, from),
      repo.offerCounts(partnerId, 'month', offset, from),
      repo.monthlyRatings(partnerId, offset, from),
    ]);

    return {
      points: periods.map((p) => buildPoint(p, jobs.get(p) ?? EMPTY_JOBS, offers.get(p) ?? EMPTY_OFFERS, ratings.get(p))),
    };
  },
};