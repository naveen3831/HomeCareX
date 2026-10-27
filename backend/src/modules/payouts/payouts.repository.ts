
import { Types } from 'mongoose';
import PartnerModel from '../../models/Partner';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';
import UserModel from '../../models/User';
import { AppError } from '../../utils/AppError';
import EarningModel from '../earnings/Earning';
import { partnerWalletLedger } from '../partner-wallet/partner-wallet.ledger';
import {
  computeBatchStatus,
  groupEarningsByPartner,
  round2,
  type PayoutStatus,
} from './payouts.calc';
import type {
  BatchRecord,
  PayoutRecord,
  PayoutsRepository,
} from './payouts.types';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === 11000;

const noEarnings = () =>
  new AppError(
    400,
    'NO_EARNINGS_TO_PAY',
    'There are no pending earnings in this period',
  );

const alreadyExists = () =>
  new AppError(
    409,
    'PAYOUT_BATCH_ALREADY_EXISTS',
    'A payout batch already exists for this period',
  );

export const payoutsRepository: PayoutsRepository = {
  /**
   * Generates a batch from pending earnings in [periodStart, periodEnd).
   * Each partner receives one payout for the batch.
   */
  async generateBatch({ periodStart, periodEnd, adminId }) {
    if (await PayoutBatchModel.exists({ periodStart, periodEnd })) {
      throw alreadyExists();
    }

    const batchId = new Types.ObjectId();
    const now = new Date();

    const candidates = await EarningModel.find({
      status: 'pending',
      payoutBatchId: null,
      earnedAt: {
        $gte: periodStart,
        $lt: periodEnd,
      },
    })
      .select('_id')
      .lean();

    if (!candidates.length) {
      throw noEarnings();
    }

    // Claim eligible earnings so they cannot be included in another batch.
    await EarningModel.updateMany(
      {
        _id: { $in: candidates.map((candidate) => candidate._id) },
        status: 'pending',
        payoutBatchId: null,
      },
      {
        $set: {
          status: 'settled',
          settledAt: now,
          payoutBatchId: batchId,
        },
      },
    );

    const claimed = await EarningModel.find({
      payoutBatchId: batchId,
    })
      .select('partnerId gross commission net')
      .lean();

    if (!claimed.length) {
      throw noEarnings();
    }

    const earningIds = claimed.map((earning) => String(earning._id));

    try {
      const groups = groupEarningsByPartner(
        claimed.map((earning) => ({
          partnerId: String(earning.partnerId),
          gross: earning.gross,
          commission: earning.commission,
          net: earning.net,
        })),
      );

      const partners = await PartnerModel.find({
        _id: { $in: groups.map((group) => group.partnerId) },
      })
        .select('bankDetails')
        .lean();

      const methodOf = (
        partnerId: string,
      ): 'upi' | 'bank_transfer' | undefined => {
        const bankDetails = partners.find(
          (partner) => String(partner._id) === partnerId,
        )?.bankDetails;

        if (bankDetails?.upiId) {
          return 'upi';
        }

        if (bankDetails?.accountLast4) {
          return 'bank_transfer';
        }

        return undefined;
      };

      const payoutDocs = groups
        .filter((group) => group.net > 0)
        .map((group) => ({
          _id: new Types.ObjectId(),
          partnerId: new Types.ObjectId(group.partnerId),
          amount: round2(group.net),
          status: 'pending' as const,
          method: methodOf(group.partnerId),
          batchId,
        }));

      if (payoutDocs.length) {
        await PayoutModel.insertMany(payoutDocs);
      }

      const batch = await PayoutBatchModel.create({
        _id: batchId,
        periodStart,
        periodEnd,
        gross: round2(
          groups.reduce((sum, group) => sum + group.gross, 0),
        ),
        commission: round2(
          groups.reduce((sum, group) => sum + group.commission, 0),
        ),
        net: round2(
          groups.reduce((sum, group) => sum + group.net, 0),
        ),
        earningIds: claimed.map((earning) => earning._id),
        payoutIds: payoutDocs.map((payout) => payout._id),
        status: 'pending',
        createdBy: new Types.ObjectId(adminId),
      });

      // Update wallet accounting after earnings have been settled.
      await partnerWalletLedger.settleEarnings(earningIds);

      return batch.toObject() as unknown as BatchRecord;
    } catch (error) {
      // Best-effort rollback of the batch, payouts, wallet and earnings.
      await PayoutModel.deleteMany({ batchId }).catch(() => undefined);

      await PayoutBatchModel.deleteOne({
        _id: batchId,
      }).catch(() => undefined);

      await partnerWalletLedger
        .unsettleEarnings(earningIds)
        .catch(() => undefined);

      await EarningModel.updateMany(
        { payoutBatchId: batchId },
        {
          $set: {
            status: 'pending',
            settledAt: null,
            payoutBatchId: null,
          },
        },
      ).catch(() => undefined);

      if (isDuplicateKeyError(error)) {
        throw alreadyExists();
      }

      throw error;
    }
  },

  /**
   * Lists payout batches with pagination and an optional status filter.
   */
  async listBatches({ page = 1, limit = 20, status }) {
    const safePage =
      Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? limit : 20;

    const match = status ? { status } : {};

    const [items, total] = await Promise.all([
      PayoutBatchModel.find(match)
        .sort({ createdAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),

      PayoutBatchModel.countDocuments(match),
    ]);

    return {
      items: items as unknown as BatchRecord[],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
      },
    };
  },

  /**
   * Finds a batch by ID.
   */
  async findBatchById(batchId) {
    const batch = await PayoutBatchModel.findById(batchId).lean();

    return batch as unknown as BatchRecord | null;
  },

  /**
   * Lists payouts in a batch and attaches the partner's name and email.
   */
  async listPayouts(batchId) {
    if (!Types.ObjectId.isValid(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'Invalid payout batch ID',
      );
    }

    const payouts = await PayoutModel.find({
      batchId: new Types.ObjectId(batchId),
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const partners = await PartnerModel.find({
      _id: { $in: payouts.map((payout) => payout.partnerId) },
    })
      .select('userId')
      .lean();

    const users = await UserModel.find({
      _id: { $in: partners.map((partner) => partner.userId) },
    })
      .select('name email')
      .lean();

    return payouts.map((payout) => {
      const partner = partners.find(
        (item) => String(item._id) === String(payout.partnerId),
      );

      const user = users.find(
        (item) => String(item._id) === String(partner?.userId),
      );

      return {
        _id: payout._id,
        partnerId: {
          _id: payout.partnerId,
          name: user?.name ?? 'Unknown partner',
          email: user?.email ?? '',
        },
        batchId: payout.batchId,
        amount: payout.amount,
        status: payout.status as PayoutStatus,
        method: payout.method ?? null,
        transactionId: payout.transactionId ?? null,
        paidAt: payout.paidAt ?? null,
        createdAt: (
          payout as unknown as { createdAt: Date }
        ).createdAt,
      } satisfies PayoutRecord;
    });
  },

  /**
   * Marks a payout as paid, records the wallet debit,
   * and recalculates its batch status.
   */
  async markPaid({ payoutId, transactionId }) {
    if (!Types.ObjectId.isValid(payoutId)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_ID',
        'Invalid payout ID',
      );
    }

    const existing = await PayoutModel.findById(payoutId).lean();

    if (!existing) {
      throw new AppError(
        404,
        'PAYOUT_NOT_FOUND',
        'Payout not found',
      );
    }

    if (existing.status === 'paid') {
      // Reconcile the wallet ledger if a previous operation was interrupted.
      if (existing.partnerId) {
        await partnerWalletLedger.debitPayout({
          partnerId: String(existing.partnerId),
          payoutId,
          amount: existing.amount,
        });
      }

      throw new AppError(
        409,
        'PAYOUT_ALREADY_PAID',
        'Payout is already in paid status',
      );
    }

    const updated = await PayoutModel.findOneAndUpdate(
      {
        _id: payoutId,
        status: { $in: ['pending', 'processing'] },
      },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          ...(transactionId ? { transactionId } : {}),
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        `Cannot change payout status from ${existing.status} to paid`,
      );
    }

    if (updated.partnerId) {
      await partnerWalletLedger.debitPayout({
        partnerId: String(updated.partnerId),
        payoutId,
        amount: updated.amount,
      });
    }

    if (updated.batchId) {
      const siblings = await PayoutModel.find({
        batchId: updated.batchId,
      })
        .select('status')
        .lean();

      await PayoutBatchModel.updateOne(
        { _id: updated.batchId },
        {
          $set: {
            status: computeBatchStatus(
              siblings.map(
                (sibling) => sibling.status as PayoutStatus,
              ),
            ),
          },
        },
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
      createdAt: (
        updated as unknown as { createdAt: Date }
      ).createdAt,
    };
  },
};

export default payoutsRepository;
