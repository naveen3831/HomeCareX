import { Types, type PipelineStage } from 'mongoose';
import BookingModel from '../../models/Booking';
import PartnerModel from '../../models/Partner';
import ReviewModel from '../../models/Review';
import { formatOffset } from '../../utils/dates';
import {
  ANSWERED_OFFER_RESPONSES,
  CANCELLED_BY_PARTNER_STATUS,
  COMPLETED_JOB_STATUSES,
  ON_TIME_GRACE_MINUTES,
  RESOLVED_JOB_STATUSES,
} from './partner-performance.constants';
import type { JobCounts, OfferCounts, RatingStat } from './partner-performance.types';

/** '%Y-%m' bucket in business time, or null to group everything into one row. */
const bucket = (field: string, by: 'month' | 'all', offsetMinutes: number) =>
  by === 'month' ? { $dateToString: { format: '%Y-%m', date: field, timezone: formatOffset(offsetMinutes) } } : null;

const count = (cond: unknown) => ({ $sum: { $cond: [cond, 1, 0] } });

export type Period = 'all' | string;

export const partnerPerformanceRepository = {
  findPartnerByUserId(userId: string) {
    return PartnerModel.findOne({ userId }).select('ratingAvg ratingCount').lean();
  },

  /**
   * Job outcomes for one partner, grouped by month (`by: 'month'`) or all together (`by: 'all'`, key 'all').
   * Arrival time is the first "arrived" entry in statusHistory, falling back to startedAt.
   */
  async jobCounts(partnerId: Types.ObjectId, by: 'month' | 'all', offsetMinutes: number, from?: Date): Promise<Map<Period, JobCounts>> {
    const isCompleted = { $in: ['$status', [...COMPLETED_JOB_STATUSES]] };
    const hasArrival = { $and: [isCompleted, { $eq: [{ $type: '$arrivedAt' }, 'date'] }] };
    const graceMs = ON_TIME_GRACE_MINUTES * 60_000;

    const pipeline: PipelineStage[] = [
      { $match: { partnerId, status: { $in: [...RESOLVED_JOB_STATUSES] }, ...(from ? { scheduledAt: { $gte: from } } : {}) } },
      {
        $addFields: {
          arrivedAt: {
            $let: {
              vars: {
                arrived: {
                  $arrayElemAt: [
                    { $filter: { input: { $ifNull: ['$statusHistory', []] }, as: 'h', cond: { $eq: ['$$h.to', 'arrived'] } } },
                    0,
                  ],
                },
              },
              in: { $ifNull: ['$$arrived.at', '$startedAt'] },
            },
          },
        },
      },
      {
        $group: {
          _id: bucket('$scheduledAt', by, offsetMinutes),
          resolved: { $sum: 1 },
          completed: count(isCompleted),
          cancelledByPartner: count({ $eq: ['$status', CANCELLED_BY_PARTNER_STATUS] }),
          withArrival: count(hasArrival),
          onTime: count({ $and: [hasArrival, { $lte: ['$arrivedAt', { $add: ['$scheduledAt', graceMs] }] }] }),
        },
      },
    ];

    const rows = await BookingModel.aggregate<JobCounts & { _id: string | null }>(pipeline);
    return new Map(rows.map(({ _id, ...c }) => [_id ?? 'all', c]));
  },

  /** Offers sent to this partner that they (or the clock) have answered. Pending offers are not counted. */
  async offerCounts(partnerId: Types.ObjectId, by: 'month' | 'all', offsetMinutes: number, from?: Date): Promise<Map<Period, OfferCounts>> {
    const pipeline: PipelineStage[] = [
      { $match: { 'offers.partnerId': partnerId } },
      { $unwind: '$offers' },
      {
        $match: {
          'offers.partnerId': partnerId,
          'offers.response': { $in: [...ANSWERED_OFFER_RESPONSES] },
          ...(from ? { 'offers.offeredAt': { $gte: from } } : {}),
        },
      },
      {
        $group: {
          _id: bucket('$offers.offeredAt', by, offsetMinutes),
          answered: { $sum: 1 },
          accepted: count({ $eq: ['$offers.response', 'accepted'] }),
        },
      },
    ];
    const rows = await BookingModel.aggregate<OfferCounts & { _id: string | null }>(pipeline);
    return new Map(rows.map(({ _id, ...c }) => [_id ?? 'all', c]));
  },

  /** Average of approved customer reviews written for this partner's completed jobs, per month of the review. */
  async monthlyRatings(partnerId: Types.ObjectId, offsetMinutes: number, from: Date): Promise<Map<string, RatingStat>> {
    const jobs = await BookingModel.find({ partnerId, status: { $in: [...COMPLETED_JOB_STATUSES] } })
      .select('_id')
      .lean();
    if (jobs.length === 0) return new Map();

    const rows = await ReviewModel.aggregate<{ _id: string; avg: number; count: number }>([
      { $match: { status: 'approved', bookingId: { $in: jobs.map((j) => j._id) }, createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: formatOffset(offsetMinutes) } },
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);
    return new Map(rows.map((r) => [r._id, { avg: r.avg, count: r.count }]));
  },
};

export type PartnerPerformanceRepository = typeof partnerPerformanceRepository;