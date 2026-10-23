
import mongoose from 'mongoose';
import { PayoutModel } from '../../models/Payout';
import { PayoutBatchModel } from '../../models/PayoutBatch';
import { EarningModel } from '../earnings/Earning';

export interface GeneratePayoutBatchInput {
  periodStart: Date;
  periodEnd: Date;
  adminId: string;
}

export interface ListPayoutBatchesInput {
  page: number;
  limit: number;
  status?: string;
}

interface BatchPayoutIds {
  payoutIds?: unknown[];
  periodStart?: Date;
  periodEnd?: Date;
}

export class PayoutsRepository {
  /**
   * Generate a payout batch from real pending earnings.
   *
   * Earnings, payouts, and the batch are updated in one MongoDB
   * transaction so a failed operation cannot partially settle earnings.
   *
   * Requires MongoDB transaction support (replica set or sharded cluster).
   */
  async generateBatch(input: GeneratePayoutBatchInput) {
    const session = await mongoose.startSession();

    try {
      let result: Record<string, unknown> | null = null;

      await session.withTransaction(async () => {
        const existingBatch = await PayoutBatchModel.findOne({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }).session(session);

        if (existingBatch) {
          throw new Error('PAYOUT_BATCH_PERIOD_EXISTS');
        }

        const earnings = await EarningModel.find({
          status: 'pending',
          earnedAt: {
            $gte: input.periodStart,
            $lt: input.periodEnd,
          },
        })
          .session(session)
          .lean();

        if (earnings.length === 0) {
          throw new Error('NO_PENDING_EARNINGS');
        }

        const partnerTotals = new Map<
          string,
          { gross: number; commission: number; net: number }
        >();

        for (const earning of earnings) {
          const partnerId = String(earning.partnerId);
          const totals = partnerTotals.get(partnerId) ?? {
            gross: 0,
            commission: 0,
            net: 0,
          };

          totals.gross += earning.gross;
          totals.commission += earning.commission;
          totals.net += earning.net;

          partnerTotals.set(partnerId, totals);
        }

        const gross = earnings.reduce(
          (sum, earning) => sum + earning.gross,
          0,
        );

        const commission = earnings.reduce(
          (sum, earning) => sum + earning.commission,
          0,
        );

        const net = earnings.reduce(
          (sum, earning) => sum + earning.net,
          0,
        );

        const [batch] = await PayoutBatchModel.create(
          [
            {
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
              gross,
              commission,
              net,
              earningIds: earnings.map((earning) => earning._id),
              payoutIds: [],
              status: 'pending',
              createdBy: new mongoose.Types.ObjectId(input.adminId),
            },
          ],
          { session },
        );

        const payoutDocuments = Array.from(partnerTotals.entries()).map(
          ([partnerId, totals]) => ({
            partnerId: new mongoose.Types.ObjectId(partnerId),
            amount: totals.net,
            status: 'pending',
          }),
        );

        const payouts = await PayoutModel.insertMany(payoutDocuments, {
          session,
        });

        batch.payoutIds = payouts.map((payout) => payout._id);
        await batch.save({ session });

        // Only settle earnings that are still pending.
        const settlement = await EarningModel.updateMany(
          {
            _id: { $in: earnings.map((earning) => earning._id) },
            status: 'pending',
          },
          {
            $set: {
              status: 'settled',
              settledAt: new Date(),
            },
          },
          { session },
        );

        if (settlement.modifiedCount !== earnings.length) {
          throw new Error('EARNINGS_SETTLEMENT_CONFLICT');
        }

        result = batch.toObject() as unknown as Record<string, unknown>;
      });

      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * List payout batches with pagination and optional status filtering.
   */
  async listBatches(input: ListPayoutBatchesInput) {
    const filter: Record<string, unknown> = {};

    if (input.status) {
      filter.status = input.status;
    }

    const skip = (input.page - 1) * input.limit;

    const [items, total] = await Promise.all([
      PayoutBatchModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(input.limit)
        .populate('createdBy', 'name email')
        .lean(),

      PayoutBatchModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        pages: Math.ceil(total / input.limit),
      },
    };
  }

  /**
   * Retrieve one payout batch.
   */
  async findBatchById(batchId: string) {
    return PayoutBatchModel.findById(batchId)
      .populate('createdBy', 'name email')
      .lean();
  }

  /**
   * List payouts belonging to a batch.
   * Returns null if the batch does not exist.
   */
  async listPayouts(batchId: string) {
    const batchResult: unknown = await PayoutBatchModel.findById(batchId)
      .select('payoutIds')
      .lean();

    if (
      !batchResult ||
      typeof batchResult !== 'object' ||
      Array.isArray(batchResult)
    ) {
      return null;
    }

    const batch = batchResult as BatchPayoutIds;

    return PayoutModel.find({
      _id: { $in: batch.payoutIds ?? [] },
    })
      .populate({
        path: 'partnerId',
        populate: {
          path: 'userId',
          select: 'name email',
        },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Retrieve one payout.
   */
  async findPayoutById(payoutId: string) {
    return PayoutModel.findById(payoutId).lean();
  }

  /**
   * Mark a payout as paid.
   *
   * This updates the application's recorded status only. It does not
   * execute or verify a bank transfer.
   */
  async updatePayoutStatus(payoutId: string, status: 'paid') {
    return PayoutModel.findOneAndUpdate(
      {
        _id: payoutId,
        status: { $in: ['pending', 'processing'] },
      },
      {
        $set: {
          status,
          paidAt: new Date(),
        },
      },
      { new: true },
    ).lean();
  }

  /**
   * Recalculate the associated batch status after a payout changes.
   */
  async updateBatchStatusForPayout(payoutId: string) {
    const payout = await PayoutModel.findById(payoutId).lean();

    if (!payout) {
      return;
    }

    const batch = await PayoutBatchModel.findOne({
      payoutIds: payout._id,
    });

    if (!batch) {
      return;
    }

    const payouts = await PayoutModel.find({
      _id: { $in: batch.payoutIds },
    }).lean();

    if (
      payouts.length > 0 &&
      payouts.every((item) => item.status === 'paid')
    ) {
      batch.status = 'completed';
    } else if (payouts.some((item) => item.status === 'failed')) {
      batch.status = 'failed';
    } else if (payouts.some((item) => item.status === 'processing')) {
      batch.status = 'processing';
    } else {
      batch.status = 'pending';
    }

    await batch.save();
  }

  /**
   * Retrieve batch payout records for CSV export.
   * Returns null if the batch does not exist.
   */
  async exportPayouts(batchId: string) {
    const batchResult: unknown = await PayoutBatchModel.findById(batchId)
      .select('payoutIds periodStart periodEnd')
      .lean();

    if (
      !batchResult ||
      typeof batchResult !== 'object' ||
      Array.isArray(batchResult)
    ) {
      return null;
    }

    const batch = batchResult as BatchPayoutIds;

    const payouts = await PayoutModel.find({
      _id: { $in: batch.payoutIds ?? [] },
    })
      .populate({
        path: 'partnerId',
        populate: {
          path: 'userId',
          select: 'name email',
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    return {
      batch: batchResult,
      payouts,
    };
  }
}

export default PayoutsRepository;
