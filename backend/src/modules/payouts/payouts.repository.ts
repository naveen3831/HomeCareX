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
