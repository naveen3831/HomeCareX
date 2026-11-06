
import { Types } from 'mongoose';
import BookingModel from '../../models/Booking';
import UserModel from '../../models/User';
import { RefundModel } from '../../models/Refund';
import PartnerModel from '../../models/Partner';
import CategoryModel from '../../models/Category';
import { EarningModel } from '../earnings/Earning';
import { REPORTS_CONSTANTS } from './reports.constants';
import type {
  BookingReportRow,
  ReportFilters,
  RevenueReportSummary,
  PartnerPerformanceReportRow,
  PartnerPerformanceReportSummary,
} from './reports.types';

type BookingAggregateRow = {
  _id: Types.ObjectId;
  createdAt: Date;
  serviceName: string;
  address?: { city?: string };
  customerId?: Types.ObjectId;
  customerName?: string;
  categoryId?: Types.ObjectId;
  partnerId?: Types.ObjectId | null;
  status: string;
  paymentStatus: string;
  priceBreakdown?: {
    total?: number;
    discount?: number;
    convenienceFee?: number;
  };
  partnerEarning?: number;
};

type RevenueAggregateRow = BookingAggregateRow & {
  commission: number;
  refund: number;
  netRevenue: number;
};

type PartnerBookingGroup = {
  _id: Types.ObjectId | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  grossEarnings: number;
  commission: number;
  netEarnings: number;
};

export class ReportsRepository {
  private buildMatch(filters: ReportFilters): Record<string, unknown> {
    const match: Record<string, unknown> = {};

    if (filters.from || filters.toExclusive) {
      match.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}),
      };
    }

    if (filters.city) {
      match['address.city'] = {
        $regex: `^${this.escapeRegex(filters.city)}$`,
        $options: 'i',
      };
    }

    if (filters.categoryId) {
      match.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters.partnerId) {
      match.partnerId = new Types.ObjectId(filters.partnerId);
    }

    if (filters.status) {
      match.status = filters.status;
    }

    return match;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async countBookings(filters: ReportFilters): Promise<number> {
    return BookingModel.countDocuments(this.buildMatch(filters));
  }

  async listBookings(
    filters: ReportFilters,
    skip: number,
    limit: number,
  ): Promise<BookingReportRow[]> {
    const rows = await BookingModel.aggregate<BookingAggregateRow>([
      { $match: this.buildMatch(filters) },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          serviceName: 1,
          address: 1,
          customerId: 1,
          customerName: 1,
          categoryId: 1,
          partnerId: 1,
          status: 1,
          paymentStatus: 1,
          priceBreakdown: 1,
          partnerEarning: 1,
        },
      },
    ]).exec();

    // Resolve readable names so the report shows people and categories, not raw ids.
    const customerIds = [
      ...new Set(
        rows
          .filter((row) => !row.customerName && row.customerId)
          .map((row) => String(row.customerId)),
      ),
    ];
    const categoryIds = [
      ...new Set(
        rows
          .filter((row) => row.categoryId)
          .map((row) => String(row.categoryId)),
      ),
    ];

    const [users, categories] = await Promise.all([
      customerIds.length > 0
        ? UserModel.find({ _id: { $in: customerIds } })
            .select('name')
            .lean()
            .exec()
        : [],
      categoryIds.length > 0
        ? CategoryModel.find({ _id: { $in: categoryIds } })
            .select('name')
            .lean()
            .exec()
        : [],
    ]);

    const userNames = new Map(
      users.map((user) => [String(user._id), String(user.name ?? '')]),
    );
    const categoryNames = new Map(
      categories.map((category) => [
        String(category._id),
        String(category.name ?? ''),
      ]),
    );

    return rows.map((row) => ({
      bookingId: String(row._id),
      createdAt: row.createdAt.toISOString(),
      serviceName: row.serviceName,
      city: row.address?.city ?? '',
      customerName:
        row.customerName ||
        (row.customerId ? userNames.get(String(row.customerId)) : '') ||
        '',
      categoryName: row.categoryId
        ? categoryNames.get(String(row.categoryId)) ?? ''
        : '',
      categoryId: row.categoryId ? String(row.categoryId) : '',
      partnerId: row.partnerId ? String(row.partnerId) : '',
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: row.priceBreakdown?.total ?? 0,
      discount: row.priceBreakdown?.discount ?? 0,
      convenienceFee: row.priceBreakdown?.convenienceFee ?? 0,
      partnerEarning: row.partnerEarning ?? 0,
    }));
  }

  async bookingSummary(filters: ReportFilters): Promise<{
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    completionRate: number;
    averageOrderValue: number;
  }> {
    const [result] = await BookingModel.aggregate<{
      totalBookings: number;
      completedBookings: number;
      cancelledBookings: number;
      completedValue: number;
    }>([
      { $match: this.buildMatch(filters) },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [...REPORTS_CONSTANTS.COMPLETED_STATUSES],
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancelledBookings: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [...REPORTS_CONSTANTS.CANCELLED_STATUSES],
                  ],
                },
                1,
                0,
              ],
            },
          },
          completedValue: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [...REPORTS_CONSTANTS.COMPLETED_STATUSES],
                  ],
                },
                { $ifNull: ['$priceBreakdown.total', 0] },
                0,
              ],
            },
          },
        },
      },
    ]).exec();

    const totalBookings = result?.totalBookings ?? 0;
    const completedBookings = result?.completedBookings ?? 0;

    return {
      totalBookings,
      completedBookings,
      cancelledBookings: result?.cancelledBookings ?? 0,
      completionRate:
        totalBookings === 0
          ? 0
          : Number(
              ((completedBookings / totalBookings) * 100).toFixed(2),
            ),
      averageOrderValue:
        completedBookings === 0
          ? 0
          : Number(
              ((result?.completedValue ?? 0) / completedBookings).toFixed(2),
            ),
    };
  }

  async revenueSummary(
    filters: ReportFilters,
  ): Promise<RevenueReportSummary> {
    const bookings = await BookingModel.aggregate<{
      _id: Types.ObjectId;
      total: number;
      discount: number;
      convenienceFee: number;
      paymentStatus: string;
    }>([
      { $match: this.buildMatch(filters) },
      {
        $project: {
          _id: 1,
          total: { $ifNull: ['$priceBreakdown.total', 0] },
          discount: { $ifNull: ['$priceBreakdown.discount', 0] },
          convenienceFee: {
            $ifNull: ['$priceBreakdown.convenienceFee', 0],
          },
          paymentStatus: 1,
        },
      },
    ]).exec();

    if (bookings.length === 0) {
      return {
        grossBookingValue: 0,
        commission: 0,
        convenienceFees: 0,
        discounts: 0,
        refunds: 0,
        netRevenue: 0,
        paidBookings: 0,
      };
    }

    const bookingIds = bookings.map((booking) => booking._id);

    const [refunds, earnings] = await Promise.all([
      RefundModel.aggregate<{
        _id: null;
        amount: number;
      }>([
        {
          $match: {
            bookingId: { $in: bookingIds },
            status: 'processed',
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: '$amount' },
          },
        },
      ]).exec(),

      EarningModel.aggregate<{
        _id: null;
        commission: number;
      }>([
        {
          $match: { bookingId: { $in: bookingIds } },
        },
        {
          $group: {
            _id: null,
            commission: { $sum: '$commission' },
          },
        },
      ]).exec(),
    ]);

    const paidBookings = bookings.filter(
      (booking) => booking.paymentStatus === 'PAID',
    );

    const grossBookingValue = paidBookings.reduce(
      (sum, booking) => sum + booking.total,
      0,
    );

    const convenienceFees = paidBookings.reduce(
      (sum, booking) => sum + booking.convenienceFee,
      0,
    );

    const discounts = paidBookings.reduce(
      (sum, booking) => sum + booking.discount,
      0,
    );

    const commission = earnings[0]?.commission ?? 0;
    const refundTotal = refunds[0]?.amount ?? 0;

    // Retains the existing definition pending accounting confirmation.
    const netRevenue = commission + convenienceFees - refundTotal;

    return {
      grossBookingValue: Number(grossBookingValue.toFixed(2)),
      commission: Number(commission.toFixed(2)),
      convenienceFees: Number(convenienceFees.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      refunds: Number(refundTotal.toFixed(2)),
      netRevenue: Number(netRevenue.toFixed(2)),
      paidBookings: paidBookings.length,
    };
  }

  /**
   * Partner performance report.
   *
   * Returns valid partners with matching bookings, resolves their real
   * names through Partner.userId -> User.name, and calculates earnings
   * from earning records associated with the filtered bookings.
   */
  async partnerPerformance(
    filters: ReportFilters,
    skip: number,
    limit: number,
  ): Promise<{
    total: number;
    summary: PartnerPerformanceReportSummary;
    data: PartnerPerformanceReportRow[];
  }> {
    const match = this.buildMatch(filters);

    const bookingGroups = await BookingModel.aggregate<PartnerBookingGroup>([
      { $match: match },
      {
        $lookup: {
          from: EarningModel.collection.name,
          localField: '_id',
          foreignField: 'bookingId',
          as: 'earningRecords',
        },
      },
      {
        $addFields: {
          bookingGrossEarnings: {
            $sum: '$earningRecords.gross',
          },
          bookingCommission: {
            $sum: '$earningRecords.commission',
          },
          bookingNetEarnings: {
            $sum: '$earningRecords.net',
          },
        },
      },
      {
        $group: {
          _id: '$partnerId',
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [...REPORTS_CONSTANTS.COMPLETED_STATUSES],
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancelledBookings: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [...REPORTS_CONSTANTS.CANCELLED_STATUSES],
                  ],
                },
                1,
                0,
              ],
            },
          },
          grossEarnings: {
            $sum: { $ifNull: ['$bookingGrossEarnings', 0] },
          },
          commission: {
            $sum: { $ifNull: ['$bookingCommission', 0] },
          },
          netEarnings: {
            $sum: { $ifNull: ['$bookingNetEarnings', 0] },
          },
        },
      },
      { $sort: { totalBookings: -1, _id: 1 } },
    ]).exec();

    // Collect only valid ObjectIds. Bookings with no partner are excluded.
    const partnerIds = bookingGroups
      .map((group) => group._id)
      .filter(
        (id): id is Types.ObjectId =>
          id instanceof Types.ObjectId,
      );

    const partners =
      partnerIds.length > 0
        ? await PartnerModel.find({
            _id: { $in: partnerIds },
          })
            .select('_id userId ratingAvg ratingCount')
            .lean()
            .exec()
        : [];

    // Collect the user IDs referenced by existing partner records.
    const userIds = partners
      .map((partner) => partner.userId)
      .filter(
        (userId): userId is Types.ObjectId =>
          userId instanceof Types.ObjectId,
      );

    // Read names from User.name.
    const users =
      userIds.length > 0
        ? await UserModel.find({
            _id: { $in: userIds },
            role: 'partner',
          })
            .select('_id name')
            .lean()
            .exec()
        : [];

    const userById = new Map(
      users.map((user) => [String(user._id), user.name]),
    );

    const partnerById = new Map(
      partners.map((partner) => [String(partner._id), partner]),
    );

    // Exclude null IDs and partner references that no longer exist.
    const validGroups = bookingGroups.filter(
      (
        group,
      ): group is PartnerBookingGroup & {
        _id: Types.ObjectId;
      } =>
        group._id instanceof Types.ObjectId &&
        partnerById.has(String(group._id)),
    );

    const allRows: PartnerPerformanceReportRow[] = validGroups.map(
      (group) => {
        const id = String(group._id);
        const partner = partnerById.get(id);

        const userId = partner?.userId
          ? String(partner.userId)
          : '';

        // Show the actual user's name; fall back only if unavailable.
        const partnerName =
          (userId ? userById.get(userId) : undefined)?.trim() || id;

        return {
          partnerId: id,
          partnerName,
          totalBookings: group.totalBookings,
          completedBookings: group.completedBookings,
          cancelledBookings: group.cancelledBookings,
          completionRate:
            group.totalBookings === 0
              ? 0
              : Number(
                  (
                    (group.completedBookings / group.totalBookings) *
                    100
                  ).toFixed(2),
                ),
          grossEarnings: Number(
            (group.grossEarnings ?? 0).toFixed(2),
          ),
          commission: Number(
            (group.commission ?? 0).toFixed(2),
          ),
          netEarnings: Number(
            (group.netEarnings ?? 0).toFixed(2),
          ),
          averageRating: partner?.ratingAvg ?? 0,
          ratingCount: partner?.ratingCount ?? 0,
        };
      },
    );

    const total = allRows.length;
    const data = allRows.slice(skip, skip + limit);

    const summary: PartnerPerformanceReportSummary = allRows.reduce(
      (result, row) => ({
        totalPartners: result.totalPartners + 1,
        totalBookings: result.totalBookings + row.totalBookings,
        completedBookings:
          result.completedBookings + row.completedBookings,
        cancelledBookings:
          result.cancelledBookings + row.cancelledBookings,
        grossEarnings: result.grossEarnings + row.grossEarnings,
        commission: result.commission + row.commission,
        netEarnings: result.netEarnings + row.netEarnings,
      }),
      {
        totalPartners: 0,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        grossEarnings: 0,
        commission: 0,
        netEarnings: 0,
      },
    );

    return {
      total,
      summary: {
        ...summary,
        grossEarnings: Number(summary.grossEarnings.toFixed(2)),
        commission: Number(summary.commission.toFixed(2)),
        netEarnings: Number(summary.netEarnings.toFixed(2)),
      },
      data,
    };
  }

  exportBookings(filters: ReportFilters) {
    return BookingModel.aggregate<BookingAggregateRow>([
      { $match: this.buildMatch(filters) },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          serviceName: 1,
          address: 1,
          categoryId: 1,
          partnerId: 1,
          status: 1,
          paymentStatus: 1,
          priceBreakdown: 1,
          partnerEarning: 1,
        },
      },
    ]).cursor({ batchSize: 500 });
  }

  exportRevenue(filters: ReportFilters) {
    return BookingModel.aggregate<RevenueAggregateRow>([
      { $match: this.buildMatch(filters) },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $lookup: {
          from: EarningModel.collection.name,
          let: { bookingId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$bookingId', '$$bookingId'] },
              },
            },
            {
              $group: {
                _id: null,
                commission: { $sum: '$commission' },
              },
            },
          ],
          as: 'earningData',
        },
      },
      {
        $lookup: {
          from: RefundModel.collection.name,
          let: { bookingId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$bookingId', '$$bookingId'] },
                status: 'processed',
              },
            },
            {
              $group: {
                _id: null,
                refund: { $sum: '$amount' },
              },
            },
          ],
          as: 'refundData',
        },
      },
      {
        $addFields: {
          commission: {
            $ifNull: [
              { $arrayElemAt: ['$earningData.commission', 0] },
              0,
            ],
          },
          refund: {
            $ifNull: [
              { $arrayElemAt: ['$refundData.refund', 0] },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          netRevenue: {
            $subtract: [
              {
                $add: [
                  '$commission',
                  { $ifNull: ['$priceBreakdown.convenienceFee', 0] },
                ],
              },
              '$refund',
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          serviceName: 1,
          address: 1,
          categoryId: 1,
          partnerId: 1,
          status: 1,
          paymentStatus: 1,
          priceBreakdown: 1,
          partnerEarning: 1,
          commission: 1,
          refund: 1,
          netRevenue: 1,
        },
      },
    ]).cursor({ batchSize: 500 });
  }
}

export const reportsRepository = new ReportsRepository();
