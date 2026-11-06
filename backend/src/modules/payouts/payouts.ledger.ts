import { Types } from 'mongoose';
import AdminWalletTransactionModel from '../../models/AdminWalletTransaction';
import PartnerModel from '../../models/Partner';
import PayoutBatchModel from '../../models/PayoutBatch';
import UserModel from '../../models/User';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const isDuplicateKeyError = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;

async function upsertLine(
  key: { type: 'partner_payout' | 'commission'; payoutId: string },
  fields: { amount: number; batchId: string; partnerId?: string; description: string; confirmedBy?: string },
): Promise<void> {
  if (fields.amount === 0) return;
  try {
    await AdminWalletTransactionModel.updateOne(
      { type: key.type, payoutId: new Types.ObjectId(key.payoutId) },
      {
        $setOnInsert: {
          amount: fields.amount,
          batchId: new Types.ObjectId(fields.batchId),
          description: fields.description,
          ...(fields.partnerId ? { partnerId: new Types.ObjectId(fields.partnerId) } : {}),
          ...(fields.confirmedBy ? { confirmedBy: new Types.ObjectId(fields.confirmedBy) } : {}),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
}

/** The only code that writes to the admin (platform) wallet ledger. Idempotent per payout. */
export const adminWalletLedger = {
  /** Payout confirmed -> commission earned (+) and the partner's net amount paid out (-). */
  async recordPayoutConfirmed(input: {
    payoutId: string;
    batchId: string;
    partnerId?: string;
    commission: number;
    net: number;
    confirmedBy?: string;
  }): Promise<void> {
    await upsertLine(
      { type: 'commission', payoutId: input.payoutId },
      {
        amount: round2(input.commission),
        batchId: input.batchId,
        partnerId: input.partnerId,
        description: 'Commission on partner payout',
        confirmedBy: input.confirmedBy,
      },
    );
    await upsertLine(
      { type: 'partner_payout', payoutId: input.payoutId },
      {
        amount: -round2(input.net),
        batchId: input.batchId,
        partnerId: input.partnerId,
        description: 'Payout credited to partner wallet',
        confirmedBy: input.confirmedBy,
      },
    );
  },

  async summary(): Promise<{ currency: 'INR'; commission: number; paidToPartners: number }> {
    const groups = await AdminWalletTransactionModel.aggregate<{ _id: string; total: number }>([
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const sum = (t: string) => groups.find((g) => g._id === t)?.total ?? 0;
    const commission = round2(sum('commission'));
    const paidToPartners = round2(Math.abs(sum('partner_payout')));
    return { currency: 'INR', commission, paidToPartners };
  },

  async recent(limit = 20) {
    return AdminWalletTransactionModel.find().sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  },

  /**
   * Paginated admin wallet history (newest first) with the partner name and batch period attached.
   * `type` filters to commission or partner_payout lines; omit it for everything.
   */
  async list(input: { type?: 'commission' | 'partner_payout'; page?: number; limit?: number } = {}) {
    const page = Number.isInteger(input.page) && (input.page as number) > 0 ? (input.page as number) : 1;
    const limit =
      Number.isInteger(input.limit) && (input.limit as number) > 0 ? Math.min(input.limit as number, 100) : 20;
    const match = input.type ? { type: input.type } : {};

    const [rows, total, totals] = await Promise.all([
      AdminWalletTransactionModel.find(match)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminWalletTransactionModel.countDocuments(match),
      AdminWalletTransactionModel.aggregate<{ _id: null; total: number }>([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const partners = await PartnerModel.find({ _id: { $in: rows.map((r) => r.partnerId).filter(Boolean) } })
      .select('userId')
      .lean();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } })
      .select('name')
      .lean();
    const batches = await PayoutBatchModel.find({ _id: { $in: rows.map((r) => r.batchId) } })
      .select('periodStart periodEnd')
      .lean();

    const items = rows.map((row) => {
      const partner = partners.find((p) => String(p._id) === String(row.partnerId));
      const user = users.find((u) => String(u._id) === String(partner?.userId));
      const batch = batches.find((b) => String(b._id) === String(row.batchId));

      return {
        id: String(row._id),
        type: row.type,
        amount: row.amount,
        description: row.description ?? '',
        payoutId: String(row.payoutId),
        batchId: String(row.batchId),
        partnerId: row.partnerId ? String(row.partnerId) : null,
        partnerName: user?.name ?? null,
        periodStart: batch?.periodStart ?? null,
        periodEnd: batch?.periodEnd ?? null,
        createdAt: (row as unknown as { createdAt: Date }).createdAt,
      };
    });

    return {
      items,
      total: round2(totals[0]?.total ?? 0),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },
};
