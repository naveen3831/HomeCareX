import { Types, type FilterQuery } from 'mongoose';
import { PAYMENT_STATUSES, PaymentModel, type IPayment, type PaymentStatus } from '../../models/Payment';
import { UserModel } from '../../models/User';
import { Errors } from '../../utils/errors';
import { ERROR_CODES } from '../../constants/errorCodes';
import { FILTER_UTC_OFFSET } from './admin-payments.constants';
import type {
  AdminPaymentDto,
  AdminPaymentsQuery,
  AdminPaymentsResult,
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

  if (q.status) and.push({ status: q.status });

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

function toDto(p: LeanPayment): AdminPaymentDto {
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
    status: p.status,
    razorpayOrderId: p.razorpayOrderId,
    razorpayPaymentId: p.razorpayPaymentId ?? null,
    attempts: p.attempts ?? 0,
    errorReason: p.errorReason ?? null,
    paidAt: iso(p.paidAt),
    refund: {
      status: p.refund?.status ?? 'none',
      amount: p.refund?.amount ?? null,
      requestedAt: iso(p.refund?.requestedAt),
    },
    createdAt: iso(p.createdAt) as string,
    updatedAt: iso(p.updatedAt) as string,
  };
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
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);

    const summary = emptySummary();
    for (const g of grouped) if (summary[g._id]) summary[g._id] = { count: g.count, amount: g.amount };

    return {
      items: rows.map(toDto),
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
    return toDto(row);
  },
};