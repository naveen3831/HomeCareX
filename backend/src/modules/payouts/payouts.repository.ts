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
import mongoose, { Types } from 'mongoose';

import EarningModel from '../earnings/Earning';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';

export class PayoutRepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PayoutRepositoryError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface GeneratePayoutBatchRepositoryInput {
  periodStart: Date;
  periodEnd: Date;
  adminId: string;
}

export interface ListPayoutBatchesRepositoryInput {
  page: number;
  limit: number;
  status?: string;
}

const PAYOUT_BATCH_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isDuplicateBatchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const mongoError = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
    message?: string;
  };

  if (mongoError.code !== 11000) {
    return false;
  }

  // The batch index is unique across both period fields.
  if (
    mongoError.keyPattern?.periodStart ||
    mongoError.keyPattern?.periodEnd
  ) {
    return true;
  }

  // Some MongoDB errors identify the index in the message instead.
  return Boolean(
    mongoError.message?.includes('periodStart_1_periodEnd_1'),
  );
}

export class PayoutsRepository {
  async listBatches(query: ListPayoutBatchesRepositoryInput) {
    if (
      !Number.isInteger(query.page) ||
      query.page < 1 ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100
    ) {
      throw new PayoutRepositoryError(
        'INVALID_PAGINATION',
        'Page must be positive and limit must be between 1 and 100.',
      );
    }

    const filter: Record<string, unknown> = {};

    if (query.status) {
      if (
        !PAYOUT_BATCH_STATUSES.includes(
          query.status as (typeof PAYOUT_BATCH_STATUSES)[number],
        )
      ) {
        throw new PayoutRepositoryError(
          'INVALID_BATCH_STATUS',
          'The payout batch status is invalid.',
        );
      }

      filter.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      PayoutBatchModel.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),

      PayoutBatchModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findBatchById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return PayoutBatchModel.findById(id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'payoutIds',
        populate: {
          path: 'partnerId',
          select: 'name email',
        },
      })
      .lean()
      .exec();
  }

  async listPayouts(batchId: string) {
    if (!Types.ObjectId.isValid(batchId)) {
      return [];
    }

    return PayoutModel.find({
      batchId: new Types.ObjectId(batchId),
    })
      .populate('partnerId', 'name email')
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();
  }

  async findEligibleEarnings(periodStart: Date, periodEnd: Date) {
    if (
      !isValidDate(periodStart) ||
      !isValidDate(periodEnd) ||
      periodStart >= periodEnd
    ) {
      throw new PayoutRepositoryError(
        'INVALID_PERIOD',
        'The payout period is invalid.',
      );
    }

    return EarningModel.find({
      status: 'settled',
      payoutBatchId: null,
      earnedAt: {
        $gte: periodStart,
        $lt: periodEnd,
      },
    })
      .select('_id partnerId bookingId gross commission net earnedAt')
      .lean()
      .exec();
  }

  /**
   * Creates a payout batch, reserves eligible earnings, and creates
   * one payout per partner within a single MongoDB transaction.
   */
  async generateBatch(input: GeneratePayoutBatchRepositoryInput) {
    if (
      typeof input.adminId !== 'string' ||
      !Types.ObjectId.isValid(input.adminId)
    ) {
      throw new PayoutRepositoryError(
        'INVALID_ADMIN_ID',
        'The admin ID is invalid.',
      );
    }

    if (
      !isValidDate(input.periodStart) ||
      !isValidDate(input.periodEnd) ||
      input.periodStart >= input.periodEnd
    ) {
      throw new PayoutRepositoryError(
        'INVALID_PERIOD',
        'The payout period is invalid.',
      );
    }

    const session = await mongoose.startSession();
    let createdBatchId: string | null = null;

    try {
      await session.withTransaction(async () => {
        const existingBatch = await PayoutBatchModel.findOne({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        })
          .session(session)
          .exec();

        if (existingBatch) {
          throw new PayoutRepositoryError(
            'PAYOUT_BATCH_ALREADY_EXISTS',
            'A payout batch already exists for this period.',
          );
        }

        const earnings = await EarningModel.find({
          status: 'settled',
          payoutBatchId: null,
          earnedAt: {
            $gte: input.periodStart,
            $lt: input.periodEnd,
          },
        })
          .session(session)
          .exec();

        if (earnings.length === 0) {
          throw new PayoutRepositoryError(
            'NO_ELIGIBLE_EARNINGS',
            'No eligible settled earnings were found for this period.',
          );
        }

        const earningIds = earnings.map((earning) => earning._id);

        const gross = roundMoney(
          earnings.reduce((sum, earning) => sum + earning.gross, 0),
        );

        const commission = roundMoney(
          earnings.reduce((sum, earning) => sum + earning.commission, 0),
        );

        const net = roundMoney(
          earnings.reduce((sum, earning) => sum + earning.net, 0),
        );

        const [batch] = await PayoutBatchModel.create(
          [
            {
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
              gross,
              commission,
              net,
              earningIds,
              payoutIds: [],
              status: 'pending',
              createdBy: new Types.ObjectId(input.adminId),
            },
          ],
          { session },
        );

        // Reserve only earnings that remain eligible.
        const reservation = await EarningModel.updateMany(
          {
            _id: { $in: earningIds },
            status: 'settled',
            payoutBatchId: null,
          },
          {
            $set: {
              payoutBatchId: batch._id,
            },
          },
          { session },
        ).exec();

        if (reservation.modifiedCount !== earnings.length) {
          throw new PayoutRepositoryError(
            'PAYOUT_EARNINGS_RESERVATION_CONFLICT',
            'Some earnings have already been assigned to another batch.',
          );
        }

        // Group earnings by partner so each partner receives one payout.
        const partnerTotals = new Map<
          string,
          {
            partnerId: Types.ObjectId;
            amount: number;
          }
        >();

        for (const earning of earnings) {
          const partnerId = earning.partnerId as Types.ObjectId;

          if (!Types.ObjectId.isValid(String(partnerId))) {
            throw new PayoutRepositoryError(
              'INVALID_PARTNER_ID',
              'An eligible earning has an invalid partner ID.',
            );
          }

          const partnerKey = String(partnerId);
          const existing = partnerTotals.get(partnerKey);

          if (existing) {
            existing.amount += earning.net;
          } else {
            partnerTotals.set(partnerKey, {
              partnerId,
              amount: earning.net,
            });
          }
        }

        const payoutDocuments = Array.from(partnerTotals.values()).map(
          (partner) => ({
            partnerId: partner.partnerId,
            batchId: batch._id,
            amount: roundMoney(partner.amount),
            status: 'pending' as const,
          }),
        );

        if (payoutDocuments.length === 0) {
          throw new PayoutRepositoryError(
            'NO_ELIGIBLE_EARNINGS',
            'No partner payouts could be generated.',
          );
        }

        const payouts = await PayoutModel.create(payoutDocuments, {
          session,
        });

        const payoutIds = payouts.map((payout) => payout._id);

        const batchUpdate = await PayoutBatchModel.updateOne(
          { _id: batch._id },
          {
            $set: {
              payoutIds,
            },
          },
          { session },
        ).exec();

        if (batchUpdate.matchedCount !== 1) {
          throw new PayoutRepositoryError(
            'PAYOUT_BATCH_CREATION_FAILED',
            'The generated payouts could not be linked to the batch.',
          );
        }

        // Retain the ID after the transaction callback finishes.
        createdBatchId = String(batch._id);
      });
    } catch (error: unknown) {
      // Preserve deliberate business-validation errors.
      if (error instanceof PayoutRepositoryError) {
        throw error;
      }

      // Handle races where another request creates the same period.
      if (isDuplicateBatchError(error)) {
        throw new PayoutRepositoryError(
          'PAYOUT_BATCH_ALREADY_EXISTS',
          'A payout batch already exists for this period.',
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }

    const batchId = createdBatchId;

    if (!batchId) {
      throw new PayoutRepositoryError(
        'PAYOUT_BATCH_CREATION_FAILED',
        'The payout batch could not be created.',
      );
    }

    const result = await this.findBatchById(batchId);

    if (!result) {
      throw new PayoutRepositoryError(
        'PAYOUT_BATCH_NOT_FOUND',
        'The generated payout batch could not be retrieved.',
      );
    }

    return result;
  }
}

export const payoutsRepository = new PayoutsRepository();

export default payoutsRepository;
