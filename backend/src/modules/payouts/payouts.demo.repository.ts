
import { Types } from 'mongoose';

const batches: Array<Record<string, any>> = [];
const payouts: Array<Record<string, any>> = [];

export const payoutsDemoRepository = {
  async generateBatch(input: {
    periodStart: Date;
    periodEnd: Date;
    adminId: string;
  }) {
    const existing = batches.find(
      (batch) =>
        batch.periodStart.getTime() === input.periodStart.getTime() &&
        batch.periodEnd.getTime() === input.periodEnd.getTime(),
    );

    if (existing) {
      const error = new Error(
        'A payout batch already exists for this period',
      ) as Error & { code: string };

      error.code = 'PAYOUT_BATCH_ALREADY_EXISTS';
      throw error;
    }

    const batchId = new Types.ObjectId();
    const now = new Date();

    // Illustrative demo values only. No real earnings are read.
    const gross = 3000;
    const commission = 300;
    const net = 2700;

    const partnerId = new Types.ObjectId();
    const payoutId = new Types.ObjectId();

    const batch = {
      _id: batchId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      gross,
      commission,
      net,
      status: 'pending',
      createdBy: new Types.ObjectId(input.adminId),
      earningIds: [],
      payoutIds: [payoutId],
      createdAt: now,
      updatedAt: now,
    };

    const payout = {
      _id: payoutId,
      partnerId: {
        _id: partnerId,
        name: 'Demo Partner',
        email: 'demo.partner@example.com',
      },
      batchId,
      amount: net,
      status: 'pending',
      paidAt: null,
      createdAt: now,
    };

    batches.unshift(batch);
    payouts.unshift(payout);

    return batch;
  },

  async listBatches(input: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const filtered = input.status
      ? batches.filter((batch) => batch.status === input.status)
      : batches;

    const start = (input.page - 1) * input.limit;
    const items = filtered.slice(start, start + input.limit);

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / input.limit),
      },
    };
  },

  async findBatchById(batchId: string) {
    return (
      batches.find((batch) => String(batch._id) === batchId) ?? null
    );
  },

  async listPayouts(batchId: string) {
    return payouts.filter(
      (payout) => String(payout.batchId) === batchId,
    );
  },
};