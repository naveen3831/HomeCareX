import BookingModel from '../../models/Booking';
import PartnerModel from '../../models/Partner';
import UserModel from '../../models/User';
import EarningModel from '../earnings/Earning';
import type { SettlementChannel } from '../earnings/earnings.constants';
import { Errors } from '../../utils/errors';
import {
  businessTzOffsetMinutes,
  formatOffset,
  isRealDate,
  parseLocalDate,
  toLocalDateString,
  weekStart,
} from '../../utils/dates';

/**
 * Daily / weekly credit-debit report for the admin Payouts page: for every period, how much the ADMIN received
 * and how much moved in and out of PARTNER wallets.
 *
 *   adminReceived    platform commission of every job settled in the period (online, QR and cash jobs alike)
 *   partnerCredited  partner share credited to partner wallets (online + QR jobs)
 *   partnerDebited   admin commission cut from partner wallets (cash-on-service jobs the partner was paid in cash)
 *   partnerNet       partnerCredited - partnerDebited
 *
 * Source: settled Earning rows, bucketed by the business-time day they were settled (IST by default).
 */

export type LedgerFrequency = 'daily' | 'weekly';

export interface LedgerPeriodDto {
  /** First day of the period, "YYYY-MM-DD" (a Monday for weekly). */
  periodStart: string;
  /** Last day of the period, inclusive, "YYYY-MM-DD" (a Sunday for weekly). */
  periodEnd: string;
  jobs: number;
  onlineJobs: number;
  qrJobs: number;
  cashJobs: number;
  gross: number;
  adminReceived: number;
  partnerCredited: number;
  partnerDebited: number;
  partnerNet: number;
}

export interface LedgerReportDto {
  currency: 'INR';
  frequency: LedgerFrequency;
  from: string;
  to: string;
  totals: Omit<LedgerPeriodDto, 'periodStart' | 'periodEnd'>;
  periods: LedgerPeriodDto[];
}

export interface LedgerLineDto {
  earningId: string;
  bookingId: string;
  bookingRef: string;
  serviceName: string;
  partnerId: string;
  partnerName: string;
  channel: SettlementChannel;
  gross: number;
  /** Always +commission: what the admin received for this job. */
  adminAmount: number;
  /** +net credited to the partner wallet, or -commission debited from it (cash job). */
  partnerAmount: number;
  settledAt: string;
}

export interface LedgerLinesDto {
  currency: 'INR';
  items: LedgerLineDto[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const parseDay = (label: string, value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_ONLY.test(value) || !isRealDate(value)) {
    throw Errors.badRequest(`"${label}" must be a real date in YYYY-MM-DD format`);
  }
  return value;
};

const addDays = (ymd: string, days: number, offset: number): string =>
  toLocalDateString(new Date(parseLocalDate(ymd, offset).getTime() + days * DAY_MS), offset);

const mondayOf = (ymd: string, offset: number): string =>
  toLocalDateString(weekStart(parseLocalDate(ymd, offset), offset), offset);

interface DayRow {
  _id: string;
  jobs: number;
  onlineJobs: number;
  qrJobs: number;
  cashJobs: number;
  gross: number;
  commission: number;
  credited: number;
  debited: number;
}

const emptyTotals = () => ({
  jobs: 0,
  onlineJobs: 0,
  qrJobs: 0,
  cashJobs: 0,
  gross: 0,
  adminReceived: 0,
  partnerCredited: 0,
  partnerDebited: 0,
  partnerNet: 0,
});

const finish = <T extends ReturnType<typeof emptyTotals>>(t: T): T => ({
  ...t,
  gross: round2(t.gross),
  adminReceived: round2(t.adminReceived),
  partnerCredited: round2(t.partnerCredited),
  partnerDebited: round2(t.partnerDebited),
  partnerNet: round2(t.partnerCredited - t.partnerDebited),
});

/** Resolves ?from&to&frequency into validated business-day bounds. `to` is inclusive. */
function resolveRange(input: { frequency?: unknown; from?: unknown; to?: unknown }, offset: number) {
  const frequency: LedgerFrequency = input.frequency === 'weekly' ? 'weekly' : 'daily';
  if (input.frequency !== undefined && input.frequency !== '' && input.frequency !== 'daily' && input.frequency !== 'weekly') {
    throw Errors.badRequest('"frequency" must be daily or weekly');
  }

  const today = toLocalDateString(new Date(), offset);
  let to = parseDay('to', input.to) ?? today;
  let from = parseDay('from', input.from) ?? addDays(to, frequency === 'weekly' ? -(12 * 7 - 1) : -29, offset);
  if (from > to) throw Errors.badRequest('"from" must be on or before "to"');

  // A weekly report always shows whole Monday-Sunday weeks, so a half week is never mistaken for a full one.
  if (frequency === 'weekly') from = mondayOf(from, offset);

  const days = Math.round((parseLocalDate(to, offset).getTime() - parseLocalDate(from, offset).getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) throw Errors.badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days`);

  if (frequency === 'weekly') to = addDays(mondayOf(to, offset), 6, offset);
  return { frequency, from, to };
}

export const adminLedgerReport = {
  /** GET /admin/payout-wallet/ledger?frequency=daily|weekly&from&to */
  async summary(input: { frequency?: unknown; from?: unknown; to?: unknown }): Promise<LedgerReportDto> {
    const offset = businessTzOffsetMinutes();
    const { frequency, from, to } = resolveRange(input, offset);
    const start = parseLocalDate(from, offset);
    const end = new Date(parseLocalDate(to, offset).getTime() + DAY_MS); // exclusive

    const isCash = { $eq: ['$settlementChannel', 'cod_cash'] };
    const rows = await EarningModel.aggregate<DayRow>([
      { $match: { status: 'settled', settledAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$settledAt', timezone: formatOffset(offset) } },
          jobs: { $sum: 1 },
          onlineJobs: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$settlementChannel', 'online'] }, 'online'] }, 1, 0] } },
          qrJobs: { $sum: { $cond: [{ $eq: ['$settlementChannel', 'upi_qr'] }, 1, 0] } },
          cashJobs: { $sum: { $cond: [isCash, 1, 0] } },
          gross: { $sum: '$gross' },
          commission: { $sum: '$commission' },
          credited: { $sum: { $cond: [isCash, 0, '$net'] } },
          debited: { $sum: { $cond: [isCash, '$commission', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Bucket the per-day rows into days or Monday-Sunday weeks.
    const buckets = new Map<string, ReturnType<typeof emptyTotals>>();
    for (const r of rows) {
      const key = frequency === 'weekly' ? mondayOf(r._id, offset) : r._id;
      const b = buckets.get(key) ?? emptyTotals();
      b.jobs += r.jobs;
      b.onlineJobs += r.onlineJobs;
      b.qrJobs += r.qrJobs;
      b.cashJobs += r.cashJobs;
      b.gross += r.gross;
      b.adminReceived += r.commission;
      b.partnerCredited += r.credited;
      b.partnerDebited += r.debited;
      buckets.set(key, b);
    }

    const periods: LedgerPeriodDto[] = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1)) // newest first
      .map(([periodStart, t]) => ({
        periodStart,
        periodEnd: frequency === 'weekly' ? addDays(periodStart, 6, offset) : periodStart,
        ...finish(t),
      }));

    const totals = emptyTotals();
    for (const r of rows) {
      totals.jobs += r.jobs;
      totals.onlineJobs += r.onlineJobs;
      totals.qrJobs += r.qrJobs;
      totals.cashJobs += r.cashJobs;
      totals.gross += r.gross;
      totals.adminReceived += r.commission;
      totals.partnerCredited += r.credited;
      totals.partnerDebited += r.debited;
    }

    return { currency: 'INR', frequency, from, to, totals: finish(totals), periods };
  },

  /**
   * GET /admin/payout-wallet/ledger/lines?from&to&page&limit
   * The individual services behind a period (both days inclusive), newest first.
   */
  async lines(input: { from?: unknown; to?: unknown; page?: unknown; limit?: unknown }): Promise<LedgerLinesDto> {
    const offset = businessTzOffsetMinutes();
    const from = parseDay('from', input.from);
    const to = parseDay('to', input.to);
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit)) || 50));

    const settledAt: { $gte?: Date; $lt?: Date } = {};
    if (from) settledAt.$gte = parseLocalDate(from, offset);
    if (to) settledAt.$lt = new Date(parseLocalDate(to, offset).getTime() + DAY_MS);
    const match = { status: 'settled', ...(from || to ? { settledAt } : {}) };

    const [rows, total] = await Promise.all([
      EarningModel.find(match)
        .sort({ settledAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EarningModel.countDocuments(match),
    ]);

    const bookings = await BookingModel.find({ _id: { $in: rows.map((r) => r.bookingId) } })
      .select('serviceName')
      .lean();
    const partners = await PartnerModel.find({ _id: { $in: rows.map((r) => r.partnerId) } })
      .select('userId')
      .lean();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } })
      .select('name')
      .lean();

    const serviceOf = new Map(bookings.map((b) => [String(b._id), b.serviceName]));
    const userIdOf = new Map(partners.map((p) => [String(p._id), String(p.userId)]));
    const nameOf = new Map(users.map((u) => [String(u._id), u.name]));

    const items: LedgerLineDto[] = rows.map((r) => {
      const channel = ((r.settlementChannel as SettlementChannel | null | undefined) ?? 'online') as SettlementChannel;
      const bookingId = String(r.bookingId);
      const partnerId = String(r.partnerId);
      return {
        earningId: String(r._id),
        bookingId,
        bookingRef: `BK-${bookingId.slice(-5).toUpperCase()}`,
        serviceName: serviceOf.get(bookingId) ?? 'Service',
        partnerId,
        partnerName: nameOf.get(userIdOf.get(partnerId) ?? '') ?? 'Partner',
        channel,
        gross: round2(r.gross),
        adminAmount: round2(r.commission),
        partnerAmount: channel === 'cod_cash' ? -round2(r.commission) : round2(r.net),
        settledAt: new Date(r.settledAt ?? r.earnedAt).toISOString(),
      };
    });

    return {
      currency: 'INR',
      items,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  },
};
