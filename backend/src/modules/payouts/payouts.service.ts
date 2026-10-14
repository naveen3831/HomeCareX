
import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';
import { auditService } from '../audit/audit.service';
import {
  payoutsRepository,
  PayoutRepositoryError,
} from './payouts.repository';
import { payoutsDemoRepository } from './payouts.demo.repository';

export interface GeneratePayoutBatchInput {
  periodStart: string;
  periodEnd: string;
  adminId: string;
  ip: string;
}

export interface ListPayoutBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

interface PayoutRecord {
  _id: Types.ObjectId;
  partnerId:
    | Types.ObjectId
    | {
        _id?: Types.ObjectId;
        name?: string;
        email?: string;
      };
  batchId:
    | Types.ObjectId
    | {
        _id?: Types.ObjectId;
        periodStart?: Date;
        periodEnd?: Date;
        status?: string;
      };
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paidAt?: Date | null;
  createdAt?: Date;
}

interface PayoutBatchRecord {
  _id: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: string;
}

type GenerateBatchRepositoryInput = {
  periodStart: Date;
  periodEnd: Date;
  adminId: string;
};

type PayoutsRepositoryDependency = {
  generateBatch: (
    input: GenerateBatchRepositoryInput,
  ) => Promise<unknown>;
  listBatches: (input: {
    page: number;
    limit: number;
    status?: string;
  }) => Promise<unknown>;
  findBatchById: (batchId: string) => Promise<unknown>;
  listPayouts: (batchId: string) => Promise<unknown>;
};

type AuditDependency = Pick<typeof auditService, 'recordAudit'>;

function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function parseDate(value: string, field: string): Date {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    !Number.isFinite(new Date(value).getTime())
  ) {
    throw new AppError(
      400,
      'INVALID_PAYOUT_PERIOD',
      `${field} must be a valid date`,
    );
  }

  return new Date(value);
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof PayoutRepositoryError) {
    const status =
      error.code === 'INVALID_ADMIN_ID' ||
      error.code === 'INVALID_PERIOD'
        ? 400
        : error.code === 'NO_ELIGIBLE_EARNINGS'
          ? 422
          : error.code === 'PAYOUT_BATCH_ALREADY_EXISTS' ||
              error.code === 'PAYOUT_EARNINGS_RESERVATION_CONFLICT'
            ? 409
            : 500;

    throw new AppError(status, error.code, error.message);
  }

  throw error;
}

/**
 * Escapes a value for a CSV cell.
 * Text beginning with spreadsheet formula characters is prefixed
 * with an apostrophe to reduce CSV formula-injection risk.
 */
export function escapeCsv(value: unknown): string {
  let text = value == null ? '' : String(value);

  if (
    typeof value !== 'number' &&
    /^[\s]*[=+\-@]/.test(text)
  ) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export class PayoutsService {
  constructor(
    private readonly repository: PayoutsRepositoryDependency =
      payoutsRepository,
    private readonly audit: AuditDependency = auditService,
  ) {}

  async generateBatch(input: GeneratePayoutBatchInput) {
    if (!isObjectId(input.adminId)) {
      throw new AppError(
        401,
        'INVALID_ADMIN_ID',
        'Authenticated admin ID is invalid',
      );
    }

    const periodStart = parseDate(input.periodStart, 'periodStart');
    const periodEnd = parseDate(input.periodEnd, 'periodEnd');

    if (periodStart >= periodEnd) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_PERIOD',
        'periodStart must be earlier than periodEnd',
      );
    }

    try {
      const result = await this.repository.generateBatch({
        periodStart,
        periodEnd,
        adminId: input.adminId,
      });

      const batch = result as PayoutBatchRecord | null;

      if (!batch?._id) {
        throw new Error(
          'Payout repository did not return a valid batch document',
        );
      }

      await this.audit.recordAudit({
        actor: input.adminId,
        action: 'payout.batch_generated',
        entity: 'PayoutBatch',
        entityId: String(batch._id),
        before: null,
        after: {
          periodStart,
          periodEnd,
          gross: batch.gross,
          commission: batch.commission,
          net: batch.net,
          status: batch.status,
        },
        ip: input.ip,
        result: 'Success',
      });

      return result;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async listBatches(input: ListPayoutBatchesInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        400,
        'INVALID_PAGE',
        'page must be a positive integer',
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError(
        400,
        'INVALID_LIMIT',
        'limit must be between 1 and 100',
      );
    }

    const validStatuses = [
      'pending',
      'processing',
      'completed',
      'failed',
    ];

    if (input.status && !validStatuses.includes(input.status)) {
      throw new AppError(
        400,
        'INVALID_BATCH_STATUS',
        'Invalid payout batch status',
      );
    }

    return this.repository.listBatches({
      page,
      limit,
      status: input.status,
    });
  }

  async getBatch(batchId: string) {
    if (!isObjectId(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'Invalid payout batch ID',
      );
    }

    const batch = await this.repository.findBatchById(batchId);

    if (!batch) {
      throw new AppError(
        404,
        'PAYOUT_BATCH_NOT_FOUND',
        'Payout batch not found',
      );
    }

    return batch;
  }

  async listPayouts(batchId: string) {
    if (!isObjectId(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'Invalid payout batch ID',
      );
    }

    // Use the injected repository so demo mode does not query
    // PayoutBatchModel directly.
    const batch = await this.repository.findBatchById(batchId);

    if (!batch) {
      throw new AppError(
        404,
        'PAYOUT_BATCH_NOT_FOUND',
        'Payout batch not found',
      );
    }

    return this.repository.listPayouts(batchId);
  }

  async markPaid(input: {
    payoutId: string;
    adminId: string;
    ip: string;
  }) {
    const { payoutId, adminId, ip } = input;

    if (!isObjectId(payoutId)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_ID',
        'Invalid payout ID',
      );
    }

    if (!isObjectId(adminId)) {
      throw new AppError(
        401,
        'INVALID_ADMIN_ID',
        'Authenticated admin ID is invalid',
      );
    }

    const beforeResult = await PayoutModel.findById(payoutId).lean();
    const before = beforeResult as unknown as PayoutRecord | null;

    if (!before) {
      throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found');
    }

    if (before.status === 'paid') {
      throw new AppError(
        409,
        'PAYOUT_ALREADY_PAID',
        'This payout is already marked as paid',
      );
    }

    const paidAt = new Date();

    const payoutResult = await PayoutModel.findOneAndUpdate(
      {
        _id: payoutId,
        status: { $in: ['pending', 'processing'] },
      },
      {
        $set: {
          status: 'paid',
          paidAt,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate('partnerId', 'name email')
      .lean();

    const payout = payoutResult as unknown as PayoutRecord | null;

    if (!payout) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        'The payout status changed. Refresh and try again.',
      );
    }

    const remaining = await PayoutModel.countDocuments({
      batchId: before.batchId,
      status: { $ne: 'paid' },
    });

    if (remaining === 0) {
      await PayoutBatchModel.updateOne(
        { _id: before.batchId },
        { $set: { status: 'completed' } },
      );
    } else {
      await PayoutBatchModel.updateOne(
        { _id: before.batchId, status: 'pending' },
        { $set: { status: 'processing' } },
      );
    }

    await this.audit.recordAudit({
      actor: adminId,
      action: 'payout.marked_paid',
      entity: 'Payout',
      entityId: payoutId,
      before: {
        status: before.status,
        paidAt: before.paidAt ?? null,
        amount: before.amount,
      },
      after: {
        status: payout.status,
        paidAt: payout.paidAt ?? null,
        amount: payout.amount,
        batchId: String(before.batchId),
      },
      ip,
      result: 'Success',
    });

    return payout;
  }

  async exportCsv(batchId?: string): Promise<string> {
    const filter: Record<string, unknown> = {};

    if (batchId) {
      if (!isObjectId(batchId)) {
        throw new AppError(
          400,
          'INVALID_BATCH_ID',
          'Invalid payout batch ID',
        );
      }

      const batchExists = await PayoutBatchModel.exists({
        _id: batchId,
      });

      if (!batchExists) {
        throw new AppError(
          404,
          'PAYOUT_BATCH_NOT_FOUND',
          'Payout batch not found',
        );
      }

      filter.batchId = new Types.ObjectId(batchId);
    }

    const payoutResults = await PayoutModel.find(filter)
      .populate('partnerId', 'name email')
      .populate('batchId', 'periodStart periodEnd status')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const payouts = payoutResults as unknown as PayoutRecord[];

    const rows: unknown[][] = [
      [
        'Payout ID',
        'Partner ID',
        'Partner Name',
        'Partner Email',
        'Batch ID',
        'Period Start',
        'Period End',
        'Amount INR',
        'Status',
        'Paid At',
        'Created At',
      ],
      ...payouts.map((payout) => {
        const partner =
          typeof payout.partnerId === 'object' &&
          payout.partnerId !== null &&
          'name' in payout.partnerId
            ? payout.partnerId
            : null;

        const batch =
          typeof payout.batchId === 'object' &&
          payout.batchId !== null &&
          'periodStart' in payout.batchId
            ? payout.batchId
            : null;

        return [
          String(payout._id),
          partner?._id
            ? String(partner._id)
            : String(payout.partnerId),
          partner?.name ?? '',
          partner?.email ?? '',
          batch?._id
            ? String(batch._id)
            : String(payout.batchId),
          batch?.periodStart?.toISOString() ?? '',
          batch?.periodEnd?.toISOString() ?? '',
          Number(payout.amount).toFixed(2),
          payout.status,
          payout.paidAt?.toISOString() ?? '',
          payout.createdAt?.toISOString() ?? '',
        ];
      }),
    ];

    return rows
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n');
  }
}

// Enable the in-memory repository only when BOTH environment flags
// explicitly indicate local development demo mode.
const payoutsDemoMode =
  process.env.NODE_ENV === 'development' &&
  process.env.PAYOUTS_DEMO_MODE === 'true';

const demoAudit: AuditDependency = {
  recordAudit: async (...args) => {
    return auditService.recordAudit(...args);
  },
};

export const payoutsService = payoutsDemoMode
  ? new PayoutsService(payoutsDemoRepository, demoAudit)
  : new PayoutsService();

export default payoutsService;