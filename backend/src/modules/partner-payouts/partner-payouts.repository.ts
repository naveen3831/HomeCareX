import { Types } from 'mongoose';
import PartnerModel from '../../models/Partner';
import PayoutModel from '../../models/Payout';
import type { PayoutMethod, PayoutStatus } from './partner-payouts.types';

export interface PayoutRowRaw {
  id: string;
  amount: number;
  status: PayoutStatus;
  method: PayoutMethod | null;
  transactionId: string | null;
  batchId: string | null;
  paidAt: Date | null;
  expectedDate: Date | null;
  createdAt: Date;
}

type PayoutLean = {
  _id: Types.ObjectId;
  amount: number;
  status: PayoutStatus;
  method?: PayoutMethod;
  transactionId?: string;
  batchId?: Types.ObjectId;
  paidAt?: Date;
  expectedDate?: Date;
  createdAt: Date;
};

const mapRow = (r: PayoutLean): PayoutRowRaw => ({
  id: String(r._id),
  amount: r.amount,
  status: r.status,
  method: r.method ?? null,
  transactionId: r.transactionId ?? null,
  batchId: r.batchId ? String(r.batchId) : null,
  paidAt: r.paidAt ?? null,
  expectedDate: r.expectedDate ?? null,
  createdAt: r.createdAt,
});

/** The partner id is always part of every match, so a query can never read another partner's payouts. */
export const partnerPayoutsRepository = {
  findPartnerIdByUserId: async (userId: string): Promise<string | null> => {
    const partner = await PartnerModel.findOne({ userId }).select('_id').lean();
    return partner ? String(partner._id) : null;
  },

  /** History, newest first. The `_id` tie-break keeps the order stable. */
  listHistory: async (partnerId: string, status: PayoutStatus | undefined, limit: number): Promise<PayoutRowRaw[]> => {
    const match: Record<string, unknown> = { partnerId: new Types.ObjectId(partnerId) };
    if (status) match.status = status;
    const rows = await PayoutModel.find(match).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<PayoutLean[]>();
    return rows.map(mapRow);
  },

  /** Oldest unfinished payout: the one the partner is waiting on. Rows without a date sort last. */
  findNext: async (partnerId: string): Promise<PayoutRowRaw | null> => {
    const rows = await PayoutModel.aggregate<PayoutLean>([
      { $match: { partnerId: new Types.ObjectId(partnerId), status: { $in: ['pending', 'processing'] } } },
      { $addFields: { _noDate: { $cond: [{ $ifNull: ['$expectedDate', false] }, 0, 1] } } },
      { $sort: { _noDate: 1, expectedDate: 1, createdAt: 1, _id: 1 } },
      { $limit: 1 },
    ]);
    return rows[0] ? mapRow(rows[0]) : null;
  },

  findById: async (partnerId: string, id: string): Promise<PayoutRowRaw | null> => {
    const row = await PayoutModel.findOne({ _id: id, partnerId: new Types.ObjectId(partnerId) }).lean<PayoutLean>();
    return row ? mapRow(row) : null;
  },
};

export type PartnerPayoutsRepository = typeof partnerPayoutsRepository;