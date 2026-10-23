import mongoose, { Types } from 'mongoose';
import { PayoutModel } from '../../models/Payout';
import { PayoutBatchModel } from '../../models/PayoutBatch';
import { EarningModel } from '../earnings/Earning';

export const payoutsRepository = {
  async generateBatch(input: { periodStart: Date; periodEnd: Date; adminId: string }) {
    const session = await mongoose.startSession();
    let result: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const duplicate = await PayoutBatchModel.exists({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }).session(session);
        if (duplicate) {
          throw new Error('A payout batch already exists for this period.');
        }

        const earnings = await EarningModel.find({
          status: 'pending',
          earnedAt: { $gte: input.periodStart, $lt: input.periodEnd },
        }).session(session);
        const grouped = new Map<string, { gross: number; commission: number; earningIds: Types.ObjectId[] }>();
        for (const earning of earnings) {
          const partnerId = String(earning.partnerId);
          const row = grouped.get(partnerId) ?? { gross: 0, commission: 0, earningIds: [] };
          row.gross += earning.gross;
          row.commission += earning.commission;
          row.earningIds.push(earning._id);
          grouped.set(partnerId, row);
        }

        const gross = [...grouped.values()].reduce((sum, row) => sum + row.gross, 0);
        const commission = [...grouped.values()].reduce((sum, row) => sum + row.commission, 0);
        const [batch] = await PayoutBatchModel.create(
          [{
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            gross,
            commission,
            net: gross - commission,
            earningIds: [...grouped.values()].flatMap((row) => row.earningIds),
            payoutIds: [],
            status: 'pending',
            createdBy: input.adminId,
          }],
          { session },
        );
        const rows = [...grouped.entries()].map(([partnerId, values]) => ({
          partnerId,
          batchId: batch._id,
          gross: values.gross,
          commission: values.commission,
          amount: values.gross - values.commission,
          status: 'pending',
        }));
        const payouts = rows.length ? await PayoutModel.create(rows, { session }) : [];
        batch.payoutIds = payouts.map((payout) => payout._id);
        await batch.save({ session });
        if (earnings.length) {
          await EarningModel.updateMany(
            { _id: { $in: earnings.map((earning) => earning._id) }, status: 'pending' },
            { $set: { status: 'settled', settledAt: new Date() } },
            { session },
          );
        }
        result = batch.toObject();
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new Error('Payout batch transaction did not complete.');
    return result;
  },

  async listBatches(input: { page: number; limit: number; status?: string }) {
    const filter = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      PayoutBatchModel.find(filter)
        .sort({ periodStart: -1, _id: -1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
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
  },

  findBatchById(batchId: string) {
    return PayoutBatchModel.findById(batchId).lean();
  },

  listPayouts(batchId: string) {
    return PayoutModel.find({ batchId }).populate('partnerId', 'userId').sort({ _id: 1 }).lean();
  },

  markPaid(payoutId: string) {
    return PayoutModel.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['pending', 'processing'] } },
      { $set: { status: 'paid', paidAt: new Date() } },
      { new: true },
    ).lean();
  },

  async exportPayouts(batchId?: string) {
    const rows = await PayoutModel.find(batchId ? { batchId } : {})
      .populate({ path: 'partnerId', select: 'userId', populate: { path: 'userId', select: 'name email' } })
      .lean();
    return rows.map((row) => {
      const partner = row.partnerId as unknown as { userId?: { name?: string; email?: string } } | null;
      return {
        partnerName: partner?.userId?.name ?? '',
        partnerEmail: partner?.userId?.email ?? '',
        gross: row.gross,
        commission: row.commission,
        amount: row.amount,
        status: row.status,
        paidAt: row.paidAt?.toISOString() ?? '',
      };
    });
  },
};

export default payoutsRepository;
