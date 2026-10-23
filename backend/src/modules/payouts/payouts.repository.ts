import { Types } from 'mongoose';
import PartnerModel from '../../models/Partner';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';
import UserModel from '../../models/User';
import { AppError } from '../../utils/AppError';
import EarningModel from '../earnings/Earning';
import { partnerWalletLedger } from '../partner-wallet/partner-wallet.ledger';
import { computeBatchStatus, groupEarningsByPartner, round2, type PayoutStatus } from './payouts.calc';
import type { BatchRecord, PayoutRecord, PayoutsRepository } from './payouts.types';

const isDuplicateKeyError = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;

const noEarnings = () => new AppError(400, 'NO_EARNINGS_TO_PAY', 'There are no pending earnings in this period');
const alreadyExists = () => new AppError(409, 'PAYOUT_BATCH_ALREADY_EXISTS', 'A payout batch already exists for this period');

export const payoutsRepository: PayoutsRepository = {
  /**
   * Turns every pending earning with earnedAt in [periodStart, periodEnd) into one payout per partner.
   * Earnings are claimed with a conditional update stamped with the new batch id, so two batches
   * (or two clicks) can never pay the same earning twice.
   */
  async generateBatch({ periodStart, periodEnd, adminId }) {
    if (await PayoutBatchModel.exists({ periodStart, periodEnd })) throw alreadyExists();

    const batchId = new Types.ObjectId();
    const now = new Date();

    const candidates = await EarningModel.find({
      status: 'pending',
      payoutBatchId: null,
      earnedAt: { $gte: periodStart, $lt: periodEnd },
    })
      .select('_id')
      .lean();
    if (!candidates.length) throw noEarnings();

    await EarningModel.updateMany(
      { _id: { $in: candidates.map((c) => c._id) }, status: 'pending', payoutBatchId: null },
      { $set: { status: 'settled', settledAt: now, payoutBatchId: batchId } },
    );
    const claimed = await EarningModel.find({ payoutBatchId: batchId }).select('partnerId gross commission net').lean();
    if (!claimed.length) throw noEarnings();

    const earningIds = claimed.map((e) => String(e._id));
    try {
      const groups = groupEarningsByPartner(
        claimed.map((e) => ({ partnerId: String(e.partnerId), gross: e.gross, commission: e.commission, net: e.net })),
      );

      const partners = await PartnerModel.find({ _id: { $in: groups.map((g) => g.partnerId) } })
        .select('bankDetails')
        .lean();
      const methodOf = (partnerId: string): 'upi' | 'bank_transfer' | undefined => {
        const b = partners.find((p) => String(p._id) === partnerId)?.bankDetails;
        return b?.upiId ? 'upi' : b?.accountLast4 ? 'bank_transfer' : undefined;
      };

      const payoutDocs = groups
        .filter((g) => g.net > 0)
        .map((g) => ({
          _id: new Types.ObjectId(),
          partnerId: new Types.ObjectId(g.partnerId),
          amount: g.net,
          status: 'pending' as const,
          method: methodOf(g.partnerId),
          batchId,
        }));
      if (payoutDocs.length) await PayoutModel.insertMany(payoutDocs);

      const batch = await PayoutBatchModel.create({
        _id: batchId,
        periodStart,
        periodEnd,
        gross: round2(groups.reduce((s, g) => s + g.gross, 0)),
        commission: round2(groups.reduce((s, g) => s + g.commission, 0)),
        net: round2(groups.reduce((s, g) => s + g.net, 0)),
        earningIds: claimed.map((e) => e._id),
        payoutIds: payoutDocs.map((p) => p._id),
        status: 'pending',
        createdBy: new Types.ObjectId(adminId),
      });

      // Cleared earnings now count in the partner's available balance.
      await partnerWalletLedger.settleEarnings(earningIds);
      return batch.toObject() as unknown as BatchRecord;
    } catch (err) {
      // Best-effort undo so the earnings go back into the pool for the next attempt.
      await PayoutModel.deleteMany({ batchId }).catch(() => undefined);
      await PayoutBatchModel.deleteOne({ _id: batchId }).catch(() => undefined);
      await partnerWalletLedger.unsettleEarnings(earningIds).catch(() => undefined);
      await EarningModel.updateMany(
        { payoutBatchId: batchId },
        { $set: { status: 'pending', settledAt: null, payoutBatchId: null } },
      ).catch(() => undefined);
      if (isDuplicateKeyError(err)) throw alreadyExists();
      throw err;
    }
  },

  async listBatches({ page, limit, status }) {
    const match = status ? { status } : {};
    const [items, total] = await Promise.all([
      PayoutBatchModel.find(match)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PayoutBatchModel.countDocuments(match),
    ]);
    return {
      items: items as unknown as BatchRecord[],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  async findBatchById(batchId) {
    return (await PayoutBatchModel.findById(batchId).lean()) as unknown as BatchRecord | null;
  },

  /** Payouts of one batch with the partner's name and email attached. */
  async listPayouts(batchId) {
    const payouts = await PayoutModel.find({ batchId: new Types.ObjectId(batchId) })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const partners = await PartnerModel.find({ _id: { $in: payouts.map((p) => p.partnerId) } })
      .select('userId')
      .lean();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } })
      .select('name email')
      .lean();

    return payouts.map((p) => {
      const partner = partners.find((x) => String(x._id) === String(p.partnerId));
      const user = users.find((u) => String(u._id) === String(partner?.userId));
      return {
        _id: p._id,
        partnerId: { _id: p.partnerId, name: user?.name ?? 'Unknown partner', email: user?.email ?? '' },
        batchId: p.batchId,
        amount: p.amount,
        status: p.status as PayoutStatus,
        method: p.method ?? null,
        transactionId: p.transactionId ?? null,
        paidAt: p.paidAt ?? null,
        createdAt: (p as unknown as { createdAt: Date }).createdAt,
      } satisfies PayoutRecord;
    });
  },

  /** pending/processing -> paid, then the matching debit in the partner wallet, then the batch status. */
  async markPaid({ payoutId, transactionId }) {
    const existing = await PayoutModel.findById(payoutId).lean();
    if (!existing) throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found');

    if (existing.status === 'paid') {
      // Heals a previous run that marked it paid but failed before writing the wallet line.
      if (existing.partnerId) {
        await partnerWalletLedger.debitPayout({ partnerId: String(existing.partnerId), payoutId, amount: existing.amount });
      }
      throw new AppError(409, 'PAYOUT_ALREADY_PAID', 'Payout is already in paid status');
    }

    const updated = await PayoutModel.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['pending', 'processing'] } },
      { $set: { status: 'paid', paidAt: new Date(), ...(transactionId ? { transactionId } : {}) } },
      { new: true },
    ).lean();
    if (!updated) {
      throw new AppError(409, 'PAYOUT_STATUS_CONFLICT', `Cannot change payout status from ${existing.status} to paid`);
    }

    if (updated.partnerId) {
      await partnerWalletLedger.debitPayout({ partnerId: String(updated.partnerId), payoutId, amount: updated.amount });
    }

    if (updated.batchId) {
      const siblings = await PayoutModel.find({ batchId: updated.batchId }).select('status').lean();
      await PayoutBatchModel.updateOne(
        { _id: updated.batchId },
        { $set: { status: computeBatchStatus(siblings.map((s) => s.status as PayoutStatus)) } },
      );
    }

    return {
      _id: updated._id,
      partnerId: updated.partnerId,
      batchId: updated.batchId,
      amount: updated.amount,
      status: updated.status as PayoutStatus,
      method: updated.method ?? null,
      transactionId: updated.transactionId ?? null,
      paidAt: updated.paidAt ?? null,
      createdAt: (updated as unknown as { createdAt: Date }).createdAt,
    };
  },
};
