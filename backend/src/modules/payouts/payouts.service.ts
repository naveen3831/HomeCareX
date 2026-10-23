
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { PayoutsRepository } from './payouts.repository';
import { PAYOUTS_CONSTANTS } from './payouts.constants';

type AuditWriter = {
  recordAudit(input: {
    actor: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip: string;
    result: 'Success' | 'Failed';
  }): Promise<unknown>;
};

type PayoutRepositoryLike = {
  generateBatch(input: {
    periodStart: Date;
    periodEnd: Date;
    adminId: string;
  }): Promise<unknown>;

  listBatches(input: {
    page: number;
    limit: number;
    status?: string;
  }): Promise<unknown>;

  findBatchById(batchId: string): Promise<unknown>;
  listPayouts(batchId: string): Promise<unknown>;

  findPayoutById?(payoutId: string): Promise<unknown>;

  updatePayoutStatus?(
    payoutId: string,
    status: 'paid',
  ): Promise<unknown>;

  updateBatchStatusForPayout?(
    payoutId: string,
  ): Promise<unknown>;

  exportPayouts?(batchId: string): Promise<unknown>;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  const text = String(value);

  // Prevent spreadsheet formula injection for text values.
  return /^[\s]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;
}

/**
 * Produces a quoted CSV cell and protects against
 * spreadsheet formula injection.
 */
export function escapeCsv(value: unknown): string {
  const safeValue = csvValue(value).replace(/"/g, '""');
  return `"${safeValue}"`;
}

export class PayoutsService {
  constructor(
    private readonly repository: PayoutRepositoryLike =
      new PayoutsRepository(),
    private readonly audit: AuditWriter = auditService,
  ) {}

  private requireObjectId(
    value: string,
    code: string,
    statusCode = 400,
  ): void {
    if (
      typeof value !== 'string' ||
      !mongoose.Types.ObjectId.isValid(value) ||
      !/^[a-f\d]{24}$/i.test(value)
    ) {
      throw new AppError(
        statusCode,
        code,
        'Invalid identifier',
      );
    }
  }

  async generateBatch(input: {
    periodStart: string;
    periodEnd: string;
    adminId: string;
    ip: string;
  }): Promise<unknown> {
    this.requireObjectId(
      input.adminId,
      'INVALID_ADMIN_ID',
      401,
    );

    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);

    if (
      !input.periodStart ||
      !input.periodEnd ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_PERIOD',
        'The payout period must have valid dates and the start must be before the end',
      );
    }

    let batch: unknown;

    try {
      batch = await this.repository.generateBatch({
        periodStart: start,
        periodEnd: end,
        adminId: input.adminId,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === 'NO_PENDING_EARNINGS'
      ) {
        throw new AppError(
          400,
          'NO_PENDING_EARNINGS',
          'No pending earnings were found for the selected payout period.',
        );
      }

      if (
        error instanceof Error &&
        error.message === 'PAYOUT_BATCH_PERIOD_EXISTS'
      ) {
        throw new AppError(
          409,
          'PAYOUT_BATCH_PERIOD_EXISTS',
          'A payout batch already exists for this period.',
        );
      }

      if (
        error instanceof Error &&
        error.message === 'EARNINGS_SETTLEMENT_CONFLICT'
      ) {
        throw new AppError(
          409,
          'EARNINGS_SETTLEMENT_CONFLICT',
          'Some earnings changed during payout generation. Please retry after checking the current records.',
        );
      }

      // Preserve unexpected errors for centralized error handling.
      throw error;
    }

    const batchId =
      isRecord(batch) && batch._id !== undefined
        ? String(batch._id)
        : `${start.toISOString()}_${end.toISOString()}`;

    await this.audit.recordAudit({
      actor: input.adminId,
      action: 'PAYOUT_BATCH_GENERATED',
      entity: 'PayoutBatch',
      entityId: batchId,
      after: batch,
      ip: input.ip,
      result: 'Success',
    });

    return batch;
  }

  async listBatches(
    input: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
  ): Promise<unknown> {
    const page =
      input.page ?? PAYOUTS_CONSTANTS.DEFAULT_PAGE;

    const limit =
      input.limit ?? PAYOUTS_CONSTANTS.DEFAULT_LIMIT;

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        400,
        'INVALID_PAGE',
        'Page must be a positive integer',
      );
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > PAYOUTS_CONSTANTS.MAX_LIMIT
    ) {
      throw new AppError(
        400,
        'INVALID_LIMIT',
        `Limit must be between 1 and ${PAYOUTS_CONSTANTS.MAX_LIMIT}`,
      );
    }

    if (
      input.status &&
      !(
        PAYOUTS_CONSTANTS.BATCH_STATUSES as readonly string[]
      ).includes(input.status)
    ) {
      throw new AppError(
        400,
        'INVALID_BATCH_STATUS',
        'Unsupported payout batch status',
      );
    }

    return this.repository.listBatches({
      page,
      limit,
      ...(input.status
        ? { status: input.status }
        : {}),
    });
  }

  async getBatch(batchId: string): Promise<unknown> {
    this.requireObjectId(
      batchId,
      'INVALID_BATCH_ID',
    );

    const batch =
      await this.repository.findBatchById(batchId);

    if (!batch) {
      throw new AppError(
        404,
        'BATCH_NOT_FOUND',
        'Payout batch not found',
      );
    }

    return batch;
  }

  async listPayouts(batchId: string): Promise<unknown> {
    this.requireObjectId(
      batchId,
      'INVALID_BATCH_ID',
    );

    const payouts =
      await this.repository.listPayouts(batchId);

    if (payouts === null) {
      throw new AppError(
        404,
        'BATCH_NOT_FOUND',
        'Payout batch not found',
      );
    }

    return payouts;
  }

  async markPaid(input: {
    payoutId: string;
    adminId: string;
    ip: string;
  }): Promise<unknown> {
    this.requireObjectId(
      input.payoutId,
      'INVALID_PAYOUT_ID',
    );

    this.requireObjectId(
      input.adminId,
      'INVALID_ADMIN_ID',
      401,
    );

    if (
      !this.repository.findPayoutById ||
      !this.repository.updatePayoutStatus
    ) {
      throw new AppError(
        500,
        'PAYOUT_REPOSITORY_INCOMPLETE',
        'Payout repository cannot update payouts',
      );
    }

    const before =
      await this.repository.findPayoutById(
        input.payoutId,
      );

    if (!before) {
      throw new AppError(
        404,
        'PAYOUT_NOT_FOUND',
        'Payout not found',
      );
    }

    if (!isRecord(before)) {
      throw new AppError(
        500,
        'INVALID_PAYOUT_RECORD',
        'Payout record is invalid',
      );
    }

    if (before.status === 'paid') {
      throw new AppError(
        409,
        'PAYOUT_ALREADY_PAID',
        'Payout is already paid',
      );
    }

    if (
      before.status !== 'pending' &&
      before.status !== 'processing'
    ) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_INVALID',
        'Only pending or processing payouts can be marked paid',
      );
    }

    const updated =
      await this.repository.updatePayoutStatus(
        input.payoutId,
        'paid',
      );

    if (!updated) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        'Payout status changed; refresh and try again',
      );
    }

    await this.repository
      .updateBatchStatusForPayout?.(
        input.payoutId,
      );

    await this.audit.recordAudit({
      actor: input.adminId,
      action: 'PAYOUT_MARKED_PAID',
      entity: 'Payout',
      entityId: input.payoutId,
      before,
      after: updated,
      ip: input.ip,
      result: 'Success',
    });

    return updated;
  }

  async exportCsv(batchId: string): Promise<string> {
    this.requireObjectId(
      batchId,
      'INVALID_BATCH_ID',
    );

    if (!this.repository.exportPayouts) {
      throw new AppError(
        500,
        'PAYOUT_REPOSITORY_INCOMPLETE',
        'Payout export is not configured',
      );
    }

    const exported =
      await this.repository.exportPayouts(batchId);

    if (!exported) {
      throw new AppError(
        404,
        'BATCH_NOT_FOUND',
        'Payout batch not found',
      );
    }

    if (
      !isRecord(exported) ||
      !Array.isArray(exported.payouts)
    ) {
      throw new AppError(
        500,
        'INVALID_PAYOUT_EXPORT',
        'Payout export data is invalid',
      );
    }

    const header = [
      'Payout ID',
      'Partner',
      'Email',
      'Amount',
      'Gross',
      'Commission',
      'Status',
      'Paid At',
    ];

    const rows = exported.payouts.map(
      (item: unknown) => {
        const payout = isRecord(item) ? item : {};
        const partner = isRecord(payout.partnerId)
          ? payout.partnerId
          : {};
        const user = isRecord(partner.userId)
          ? partner.userId
          : {};

        return [
          payout._id,
          user.name ?? partner.name,
          user.email ?? partner.email,
          payout.amount,
          payout.gross,
          payout.commission,
          payout.status,
          payout.paidAt instanceof Date
            ? payout.paidAt.toISOString()
            : payout.paidAt,
        ]
          .map(escapeCsv)
          .join(',');
      },
    );

    return [
      header.map(escapeCsv).join(','),
      ...rows,
    ].join('\r\n');
  }
}

export default PayoutsService;
