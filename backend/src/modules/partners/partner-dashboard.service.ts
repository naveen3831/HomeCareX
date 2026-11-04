import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { dayBounds } from '../../utils/dates';
import { Errors } from '../../utils/errors';
import type { ActiveJobDto, PartnerDashboardDto } from './partner-dashboard.types';
import { partnerDashboardRepository as repo } from './partner-dashboard.repository';
import { ensurePartnerProfile } from './partners.service';
import ServiceModel from '../../models/Service';
import { businessTzOffsetMinutes, toLocalDateString } from '../../utils/dates';
import { earningsService } from '../earnings/earnings.service';
import { partnerPerformanceService } from '../partner-performance/partner-performance.service';

export const partnerDashboardService = {
  /**
   * @param userId  from the verified JWT (never from the client)
   * @param requestedPartnerId optional client-supplied id; rejected unless it is the caller's own
   */
  async getDashboard(userId: string, requestedPartnerId?: string, now: Date = new Date()): Promise<PartnerDashboardDto> {
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

    const { start, end } = dayBounds(now);
    const offset = businessTzOffsetMinutes();
    const to = toLocalDateString(now, offset);
    const from = toLocalDateString(new Date(now.getTime() - 6 * 86_400_000), offset);

    const [newJobs, todayJobs, completed, completedTotal, activeDoc, earnings, ledger, performance] = await Promise.all([
      repo.countOpenOffers(partnerId, now),
      repo.countScheduled(partnerId, start, end),
      repo.completedToday(partnerId, start, end),
      repo.completedTotal(partnerId),
      repo.findActiveJob(partnerId),
      // Money comes from the earnings ledger, the same source as the Earnings page.
      earningsService.getSummary(userId, undefined, now),
      earningsService.getLedger(userId, { from, to, page: 1, limit: 1 }),
      // Rates and rating are calculated from real bookings and offers, same as the Performance page.
      partnerPerformanceService.getSummary(userId),
    ]);

    const activeJob: ActiveJobDto | null = activeDoc
      ? {
          id: activeDoc._id.toString(),
          service: activeDoc.serviceName,
          customer: activeDoc.customerName,
          address: [activeDoc.address.area, activeDoc.address.city].filter(Boolean).join(', '),
          status: activeDoc.status,
          scheduledAt: activeDoc.scheduledAt.toISOString(),
        }
      : null;

    let assignedServices: Array<{ id: string; name: string }> = [];
    const partnerServices = (partner as any).services;
    if (Array.isArray(partnerServices) && partnerServices.length > 0) {
      try {
        const docs = await ServiceModel.find({ _id: { $in: partnerServices }, active: true }).select('name').lean();
        assignedServices = docs.map((d) => ({ id: d._id.toString(), name: d.name }));
      } catch {
        // ignore
      }
    }

    return {
      newJobs,
      todayJobs,
      completedJobs: completed.count,
      todayEarnings: earnings.today,
      rating: performance.rating ?? 0,
      acceptanceRate: performance.acceptanceRate ?? 0,
      completionRate: performance.completionRate ?? 0,
      activeJob,
      earnings: {
        today: earnings.today,
        week: earnings.week,
        month: earnings.month,
        total: earnings.total,
        pending: earnings.pending,
      },
      completedTotal,
      performance: {
        rating: performance.rating,
        ratingCount: performance.ratingCount,
        acceptanceRate: performance.acceptanceRate,
        completionRate: performance.completionRate,
        onTimeRate: performance.onTimeRate,
      },
      last7Days: ledger.series.map((d) => ({ date: d.date, amount: d.net })),
      assignedServices,
    };
  },
};