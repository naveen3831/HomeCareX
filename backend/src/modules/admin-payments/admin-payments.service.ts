import { Types, type FilterQuery } from 'mongoose';
import { PAYMENT_STATUSES, PaymentModel, type IPayment, type PaymentStatus } from '../../models/Payment';
import { UserModel } from '../../models/User';
import EarningModel from '../earnings/Earning';
import { Errors } from '../../utils/errors';
import { ERROR_CODES } from '../../constants/errorCodes';
import { FILTER_UTC_OFFSET } from './admin-payments.constants';
import type {
  AdminPaymentDto,
  AdminPaymentsQuery,
  AdminPaymentsResult,
  PaymentSettlementDto,
  PaymentSummary,
} from './admin-payments.types';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObjectIdString = (value: string): boolean => /^[a-f0-9]{24}$/i.test(value);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const startOf = (v: string): Date => new Date(DATE_ONLY.test(v) ? `${v}T00:00:00.000${FILTER_UTC_OFFSET}` : v);
const endOf = (v: string): Date => new Date(DATE_ONLY.test(v) ? `${v}T23:59:59.999${FILTER_UTC_OFFSET}` : v);

/** Same convention the customer payments module uses for booking references. */
export const bookingRefOf = (bookingId: unknown): string => `BK-${String(bookingId).slice(-5).toUpperCase()}`;
export const paymentRefOf = (id: unknown): string => `PAY-${String(id).slice(-6).toUpperCase()}`;

/** Returns null when a filter can never match (e.g. unknown customer), so we can skip the query. */
async function buildFilter(q: AdminPaymentsQuery): Promise<FilterQuery<IPayment> | null> {
  const and: FilterQuery<IPayment>[] = [];

  // The status filter works on what the admin SEES (see displayStatusOf): a payment the customer has made only
  // reads "Paid" after the service is done and the money has been credited; until then it reads "Pending".
  if (q.status === 'PAID') {
    and.push({ status: 'PAID', creditedAt: { $ne: null } });
  } else if (q.status === 'PENDING') {
    and.push({ $or: [{ status: 'PENDING' }, { status: 'PAID', creditedAt: null }] });
  } else if (q.status) {
    and.push({ status: q.status });
  }

  if (q.method) {
    and.push({ method: { $regex: `^${escapeRegex(q.method)}$`, $options: 'i' } });
  }

  if (q.from || q.to) {
    const createdAt: { $gte?: Date; $lte?: Date } = {};
    if (q.from) createdAt.$gte = startOf(q.from);
    if (q.to) createdAt.$lte = endOf(q.to);
    and.push({ createdAt });
  }

  if (q.customer) {
    if (isObjectIdString(q.customer)) {
      and.push({ customerId: new Types.ObjectId(q.customer) });
    } else {
      const rx = { $regex: escapeRegex(q.customer), $options: 'i' };
      const users = await UserModel.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
        .select('_id')
        .limit(500)
        .lean();
      if (users.length === 0) return null;
      and.push({ customerId: { $in: users.map((u) => u._id) } });
    }
  }

  if (q.booking) {
    if (isObjectIdString(q.booking)) {
      and.push({ bookingId: new Types.ObjectId(q.booking) });
    } else {
      // Accept the "BK-1A2B3" reference shown in the UI (= last 5 chars of the booking id).
      const suffix = q.booking.replace(/^BK-/i, '');
      if (!/^[a-f0-9]{1,24}$/i.test(suffix)) return null;
      and.push({
        $expr: { $regexMatch: { input: { $toString: '$bookingId' }, regex: `${suffix}$`, options: 'i' } },
      } as FilterQuery<IPayment>);
    }
  }

  if (q.search) {
    const rx = { $regex: escapeRegex(q.search), $options: 'i' };
    and.push({ $or: [{ razorpayOrderId: rx }, { razorpayPaymentId: rx }] });
  }

  return and.length ? { $and: and } : {};
}

type LeanPayment = Omit<IPayment, 'customerId'> & {
  _id: Types.ObjectId;
  customerId?: Types.ObjectId | { _id: Types.ObjectId; name?: string; email?: string; phone?: string } | null;
};

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);

interface EarningLite {
  status: 'pending' | 'settled';
  net: number;
  commission: number;
  settledAt?: Date | null;
  settlementChannel?: 'online' | 'upi_qr' | 'cod_cash' | null;
}

/**
 * The status the admin sees. It only describes the customer's payment:
 *   PENDING   not paid yet, OR paid but the service is not finished / the money is not credited yet
 *   PAID      the customer paid, the service is completed and the amount has been credited
 *             (online / QR: partner wallet + admin commission; cash: admin commission cut from the partner wallet)
 *   FAILED / REFUNDED  unchanged
 * `creditedAt` is the source of truth; for old rows that never got it, a settled earning counts as credited.
 */
export function displayStatusOf(p: { status: PaymentStatus; creditedAt?: Date | null }, earning?: EarningLite): PaymentStatus {
  if (p.status !== 'PAID') return p.status;
  return p.creditedAt || earning?.status === 'settled' ? 'PAID' : 'PENDING';
}

const isCodPayment = (p: LeanPayment): boolean =>
  (p.method ?? '').toLowerCase() === 'cod' || String(p.razorpayOrderId).startsWith('cod_');

/** Where this payment's money stands after the service. Pure: the earning (if any) is passed in. */
export function settlementOf(p: LeanPayment, earning?: EarningLite): PaymentSettlementDto {
  const base = {
    partnerShare: earning ? earning.net : null,
    commission: earning ? earning.commission : null,
    creditedAt: earning?.status === 'settled' && earning.settledAt ? new Date(earning.settledAt).toISOString() : null,
  };
  const done = (state: PaymentSettlementDto['state'], label: string): PaymentSettlementDto => ({ state, label, ...base });

  if (p.status === 'REFUNDED') return done('refunded', 'Refunded to customer');
  if (p.status === 'FAILED') return done('not_applicable', 'No settlement');

  if (isCodPayment(p)) {
    if (p.status === 'PENDING') return done('cash_pending', 'Cash to be collected');
    if (earning?.status === 'settled') {
      return earning.settlementChannel === 'upi_qr'
        ? done('credited', 'Credited to partner and admin (QR payment)')
        : done('commission_deducted', 'Commission cut from partner wallet');
    }
    return done('cash_collected', 'Collected, settlement processing');
  }

  if (p.status === 'PENDING') return done('awaiting_payment', 'Awaiting payment');
  if (!earning) return done('awaiting_service', 'Held until service completes');
  if (earning.status === 'settled') return done('credited', 'Credited to partner and admin');
  return done('processing', 'Settlement processing');
}

function toDto(p: LeanPayment, earning?: EarningLite): AdminPaymentDto {
  const c = p.customerId;
  const populated = c && typeof c === 'object' && 'name' in c ? c : null;

  return {
    id: String(p._id),
    paymentRef: paymentRefOf(p._id),
    bookingId: String(p.bookingId),
    bookingRef: bookingRefOf(p.bookingId),
    customer: populated
      ? { id: String(populated._id), name: populated.name ?? '', email: populated.email, phone: populated.phone }
      : null,
    amount: p.amount,
    currency: p.currency || 'INR',
    method: p.method ?? null,
    status: displayStatusOf(p, earning),
    customerPaid: p.status === 'PAID' || p.status === 'REFUNDED',
    razorpayOrderId: p.razorpayOrderId,
    razorpayPaymentId: p.razorpayPaymentId ?? null,
    attempts: p.attempts ?? 0,
    errorReason: p.errorReason ?? null,
    paidAt: iso(p.paidAt),
    creditedAt: iso(p.creditedAt),
    refund: {
      status: p.refund?.status ?? 'none',
      amount: p.refund?.amount ?? null,
      requestedAt: iso(p.refund?.requestedAt),
    },
    settlement: settlementOf(p, earning),
    createdAt: iso(p.createdAt) as string,
    updatedAt: iso(p.updatedAt) as string,
  };
}

/** One query for the whole page: bookingId -> its earning (one earning per booking). */
async function earningsByBooking(bookingIds: unknown[]): Promise<Map<string, EarningLite>> {
  if (!bookingIds.length) return new Map();
  const rows = await EarningModel.find({ bookingId: { $in: bookingIds } })
    .select('bookingId status net commission settledAt settlementChannel')
    .lean();
  return new Map(rows.map((r) => [String(r.bookingId), r as unknown as EarningLite]));
}

const emptySummary = (): PaymentSummary =>
  Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, { count: 0, amount: 0 }])) as PaymentSummary;

export const adminPaymentsService = {
  async list(q: AdminPaymentsQuery): Promise<AdminPaymentsResult> {
    const filter = await buildFilter(q);
    if (!filter) {
      return { items: [], meta: { page: q.page, limit: q.limit, total: 0, pages: 0, summary: emptySummary() } };
    }

    const [rows, total, grouped] = await Promise.all([
      PaymentModel.find(filter)
        .select('-razorpaySignature') // secret-ish: never leaves the server
        .sort({ createdAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate('customerId', 'name email phone')
        .lean<LeanPayment[]>(),
      PaymentModel.countDocuments(filter),
      PaymentModel.aggregate<{ _id: PaymentStatus; count: number; amount: number }>([
        { $match: filter as Record<string, unknown> },
        {
          // Group by the status the admin sees: PAID without creditedAt counts as Pending.
          $group: {
            _id: {
              $cond: [
                { $and: [{ $eq: ['$status', 'PAID'] }, { $eq: [{ $ifNull: ['$creditedAt', null] }, null] }] },
                'PENDING',
                '$status',
              ],
            },
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const summary = emptySummary();
    for (const g of grouped) if (summary[g._id]) summary[g._id] = { count: g.count, amount: g.amount };

    const earnings = await earningsByBooking(rows.map((r) => r.bookingId));

    return {
      items: rows.map((r) => toDto(r, earnings.get(String(r.bookingId)))),
      meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit), summary },
    };
  },

  /** One payment for the detail page. Same whitelisted DTO as the list (no signature). */
  async getById(id: string): Promise<AdminPaymentDto> {
    if (!isObjectIdString(id)) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Payment not found');
    const row = await PaymentModel.findById(id)
      .select('-razorpaySignature')
      .populate('customerId', 'name email phone')
      .lean<LeanPayment>();
    if (!row) throw Errors.notFound(ERROR_CODES.NOT_FOUND, 'Payment not found');
    const earnings = await earningsByBooking([row.bookingId]);
    return toDto(row, earnings.get(String(row.bookingId)));
  },
};