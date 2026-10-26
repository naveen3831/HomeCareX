import { AppError } from '../../utils/AppError';
import { auditService, type AuditService } from '../audit/audit.service';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT, PAYOUT_BATCH_STATUSES } from './payouts.constants';
import { payoutsRepository } from './payouts.repository';
import type { GenerateBatchInput, ListBatchesInput, MarkPaidInput, PayoutsRepository } from './payouts.types';
import { isObjectId, parseDate } from './payouts.validation';

type RepositoryPort = Omit<PayoutsRepository, 'markPaid'> & Partial<Pick<PayoutsRepository, 'markPaid'>>;

/** CSV cell: always quoted, quotes doubled, and text that a spreadsheet would run as a formula gets a leading apostrophe. */
export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const idOf = (v: unknown): string => String((v as { _id?: unknown })?._id ?? v);

export class PayoutsService {
  constructor(
    private readonly repository: RepositoryPort = payoutsRepository,
    private readonly audit: Pick<AuditService, 'recordAudit'> = auditService,
  ) {}

  private requireAdmin(adminId: string): void {
    if (!isObjectId(adminId)) throw new AppError(401, 'INVALID_ADMIN_ID', 'A valid admin ID is required');
  }

  private requireBatchId(batchId: string): void {
    if (!isObjectId(batchId)) throw new AppError(400, 'INVALID_BATCH_ID', 'A valid payout batch ID is required');
  }

  /** An audit failure must never undo or hide a money action that already happened. */
  private async record(input: Parameters<AuditService['recordAudit']>[0]): Promise<void> {
    try {
      await this.audit.recordAudit(input);
    } catch (err) {
      console.error('[payouts] audit log failed', err);
    }
  }

  async generateBatch(input: GenerateBatchInput) {
    this.requireAdmin(input.adminId);
    const periodStart = parseDate(input.periodStart);
    const periodEnd = parseDate(input.periodEnd);
    if (!periodStart || !periodEnd) {
      throw new AppError(400, 'INVALID_PAYOUT_PERIOD', 'Enter a valid payout period start and end date');
    }
    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw new AppError(400, 'INVALID_PAYOUT_PERIOD', 'The period start must be before the period end');
    }

    const batch = await this.repository.generateBatch({ periodStart, periodEnd, adminId: input.adminId });
    await this.record({
      actor: input.adminId,
      action: 'PAYOUT_BATCH_GENERATED',
      entity: 'PayoutBatch',
      entityId: idOf(batch),
      after: { periodStart, periodEnd, gross: batch.gross, commission: batch.commission, net: batch.net, status: batch.status },
      ip: input.ip,
      result: 'Success',
    });
    return batch;
  }

  async listBatches(input: ListBatchesInput = {}) {
    const page = input.page ?? DEFAULT_PAGE;
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(page) || page < 1) throw new AppError(400, 'INVALID_PAGE', 'Page must be a whole number of 1 or more');
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new AppError(400, 'INVALID_LIMIT', `Limit must be a whole number between 1 and ${MAX_LIMIT}`);
    }
    if (input.status !== undefined && !(PAYOUT_BATCH_STATUSES as readonly string[]).includes(input.status)) {
      throw new AppError(400, 'INVALID_BATCH_STATUS', 'Unsupported payout batch status');
    }
    return this.repository.listBatches({ page, limit, status: input.status });
  }

  async getBatch(batchId: string) {
    this.requireBatchId(batchId);
    const batch = await this.repository.findBatchById(batchId);
    if (!batch) throw new AppError(404, 'PAYOUT_BATCH_NOT_FOUND', 'Payout batch not found');
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
import { alertPayoutFailed } from '../notifications/admin-alerts';

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

type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

interface PopulatedPartner {
  _id?: Types.ObjectId | string;
  name?: string;
  email?: string;
}

interface PopulatedBatch {
  _id?: Types.ObjectId | string;
  periodStart?: Date | string;
  periodEnd?: Date | string;
  status?: string;
}

interface PayoutRecord {
  _id: Types.ObjectId | string;
  partnerId: Types.ObjectId | string | PopulatedPartner;
  batchId: Types.ObjectId | string | PopulatedBatch;
  amount: number;
  status: PayoutStatus;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
}

interface PayoutBatchRecord {
  _id: Types.ObjectId | string;
  periodStart: Date | string;
  periodEnd: Date | string;
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

type AuditDependency = {
  recordAudit: (
    ...args: Parameters<typeof auditService.recordAudit>
  ) => Promise<unknown> | unknown;
};

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['processing', 'failed', 'paid'],
  processing: ['failed', 'paid'],
  failed: ['processing'],
  paid: [],
};

function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function isPayoutStatus(value: unknown): value is PayoutStatus {
  return (
    value === 'pending' ||
    value === 'processing' ||
    value === 'paid' ||
    value === 'failed'
  );
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
    const err = error as PayoutRepositoryError;
    const status =
      err.code === 'INVALID_ADMIN_ID' ||
      err.code === 'INVALID_PERIOD'
        ? 400
        : err.code === 'NO_ELIGIBLE_EARNINGS'
          ? 422
          : err.code === 'PAYOUT_BATCH_ALREADY_EXISTS' ||
              err.code === 'PAYOUT_EARNINGS_RESERVATION_CONFLICT'
            ? 409
            : 500;

    throw new AppError(status, err.code, err.message);
  }

  const code = getErrorCode(error);

  if (code === 'INVALID_PAYOUT_ID') {
    throw new AppError(400, code, 'Invalid payout ID');
  }

  if (code === 'PAYOUT_NOT_FOUND') {
    throw new AppError(404, code, 'Payout not found');
  }

  if (code === 'PAYOUT_ALREADY_PAID') {
    throw new AppError(
      409,
      code,
      'This payout is already marked as paid',
    );
  }

  if (code === 'PAYOUT_STATUS_CONFLICT') {
    throw new AppError(
      409,
      code,
      'The requested payout status transition is not allowed',
    );
  }

  if (code === 'INVALID_PAYOUT_STATUS') {
    throw new AppError(
      400,
      code,
      'Invalid payout status',
    );
  }

  throw error;
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error
  ) {
    return String(error.code);
  }

  return '';
}

function toIsoString(
  value: Date | string | null | undefined,
): string {
  if (value == null) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function idToString(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value
  ) {
    return String(value._id);
  }

  return String(value ?? '');
}

function getPartner(
  value: PayoutRecord['partnerId'],
): PopulatedPartner | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'name' in value
  ) {
    return value;
  }

  return null;
}

function getPopulatedBatch(
  value: PayoutRecord['batchId'],
): PopulatedBatch | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    ('periodStart' in value || 'periodEnd' in value)
  ) {
    return value;
  }

  return null;
}

/**
 * Escapes CSV cells and reduces spreadsheet formula-injection risk.
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

const CSV_HEADERS = [
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
];

function payoutToCsvRow(payout: PayoutRecord): unknown[] {
  const partner = getPartner(payout.partnerId);
  const batch = getPopulatedBatch(payout.batchId);

  return [
    idToString(payout._id),
    idToString(payout.partnerId),
    partner?.name ?? '',
    partner?.email ?? '',
    idToString(payout.batchId),
    toIsoString(batch?.periodStart),
    toIsoString(batch?.periodEnd),
    Number(payout.amount).toFixed(2),
    payout.status,
    toIsoString(payout.paidAt),
    toIsoString(payout.createdAt),
  ];
}

function buildCsv(rows: unknown[][]): string {
  return rows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
}

export class PayoutsService {
  constructor(
    private readonly repository: PayoutsRepositoryDependency =
      payoutsRepository,
    private readonly audit: AuditDependency = auditService,
    private readonly demoMode = false,
  ) {}

  async generateBatch(input: GeneratePayoutBatchInput) {
    if (!isObjectId(input.adminId)) {
      throw new AppError(
        401,
        'INVALID_ADMIN_ID',
        'Authenticated admin ID is invalid',
      );
    }

    const periodStart = parseDate(
      input.periodStart,
      'periodStart',
    );

    const periodEnd = parseDate(
      input.periodEnd,
      'periodEnd',
    );

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

    if (
      input.status &&
      !validStatuses.includes(input.status)
    ) {
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
    this.requireBatchId(batchId);
    return this.repository.listPayouts(batchId);
  }

  async markPaid(input: MarkPaidInput) {
    this.requireAdmin(input.adminId);
    if (!isObjectId(input.payoutId)) throw new AppError(400, 'INVALID_PAYOUT_ID', 'A valid payout ID is required');
    if (!this.repository.markPaid) throw new AppError(500, 'NOT_SUPPORTED', 'Marking payouts as paid is not available');

    const payout = await this.repository.markPaid({ payoutId: input.payoutId, transactionId: input.transactionId });
    await this.record({
      actor: input.adminId,
      action: 'PAYOUT_MARKED_PAID',
      entity: 'Payout',
      entityId: input.payoutId,
      after: { status: payout.status, amount: payout.amount, paidAt: payout.paidAt },
      ip: input.ip,
      result: 'Success',
    });
    return payout;
  }

  async exportCsv(batchId: string): Promise<{ csv: string; filename: string }> {
    this.requireBatchId(batchId);
    await this.getBatch(batchId);
    const rows = await this.repository.listPayouts(batchId);
    const header = ['Payout ID', 'Partner', 'Email', 'Amount (INR)', 'Status', 'Method', 'Transaction ID', 'Paid at'];
    const lines = rows.map((p) => {
      const partner = (p.partnerId ?? {}) as { name?: string; email?: string };
      return [String(p._id), partner.name, partner.email, p.amount, p.status, p.method, p.transactionId, p.paidAt]
        .map(escapeCsv)
        .join(',');
    });
    return { csv: [header.map(escapeCsv).join(','), ...lines].join('\r\n'), filename: `payouts-${batchId}.csv` };
  }
}

export const payoutsService = new PayoutsService();
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

    return this.repository.listPayouts(batchId);
  }

  /**
   * Update a payout's status.
   *
   * Demo mode writes only to the local demo JSON repository.
   * Normal mode updates MongoDB and records the change in the audit log.
   */
  async updateStatus(input: {
    payoutId: string;
    status: unknown;
    adminId: string;
    ip: string;
  }) {
    const { payoutId, status, adminId, ip } = input;

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

    if (!isPayoutStatus(status)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_STATUS',
        'Status must be pending, processing, paid, or failed',
      );
    }

    const nextStatus = status;

    if (this.demoMode) {
  try {
    const demoUpdated = await payoutsDemoRepository.updateStatus(
      payoutId,
      nextStatus,
    );

    if (nextStatus === 'failed') {
      const demoPartner = getPartner(
        (demoUpdated as unknown as PayoutRecord).partnerId,
      );
      alertPayoutFailed({
        payoutId,
        amount: (demoUpdated as unknown as PayoutRecord).amount,
        partnerId: demoPartner?._id ? String(demoPartner._id) : undefined,
        partnerName: demoPartner?.name,
        batchId: idToString(
          (demoUpdated as unknown as PayoutRecord).batchId,
        ),
      });
    }

    return demoUpdated;
  } catch (error) {
    mapRepositoryError(error);
  }
}
    const beforeResult = await PayoutModel.findById(payoutId).lean();
    const before = beforeResult as unknown as PayoutRecord | null;

    if (!before) {
      throw new AppError(
        404,
        'PAYOUT_NOT_FOUND',
        'Payout not found',
      );
    }

    if (before.status === nextStatus) {
      if (nextStatus === 'paid') {
        throw new AppError(
          409,
          'PAYOUT_ALREADY_PAID',
          'This payout is already marked as paid',
        );
      }

      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        `Payout is already in ${nextStatus} status`,
      );
    }

    if (!allowedTransitions[before.status].includes(nextStatus)) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        `Cannot change payout status from ${before.status} to ${nextStatus}`,
      );
    }

    const updatedResult = await PayoutModel.findOneAndUpdate(
      {
        _id: payoutId,
        status: before.status,
      },
      {
        $set: {
          status: nextStatus,
          paidAt: nextStatus === 'paid' ? new Date() : null,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate('partnerId', 'name email')
      .populate('batchId', 'periodStart periodEnd status')
      .lean();

    const updated = updatedResult as unknown as PayoutRecord | null;

    if (!updated) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        'The payout status changed concurrently. Refresh and try again.',
      );
    }

    const batchId = idToString(before.batchId);

    const remaining = await PayoutModel.countDocuments({
      batchId: new Types.ObjectId(batchId),
      status: { $ne: 'paid' },
    });

    let batchStatus = 'pending';

    if (remaining === 0) {
      batchStatus = 'completed';
    } else if (
      await PayoutModel.exists({
        batchId: new Types.ObjectId(batchId),
        status: 'processing',
      })
    ) {
      batchStatus = 'processing';
    } else if (
      await PayoutModel.exists({
        batchId: new Types.ObjectId(batchId),
        status: 'paid',
      })
    ) {
      batchStatus = 'processing';
    } else if (
      await PayoutModel.exists({
        batchId: new Types.ObjectId(batchId),
        status: 'failed',
      })
    ) {
      batchStatus = 'failed';
    }

    await PayoutBatchModel.findByIdAndUpdate(batchId, {
      $set: {
        status: batchStatus,
        updatedAt: new Date(),
      },
    });

    await this.audit.recordAudit({
      actor: adminId,
      action:
        nextStatus === 'paid'
          ? 'payout.marked_paid'
          : 'payout.status_updated',
      entity: 'Payout',
      entityId: payoutId,
      before: {
        status: before.status,
        paidAt: before.paidAt ?? null,
        amount: before.amount,
      },
      after: {
        status: nextStatus,
        paidAt: updated.paidAt ?? null,
        amount: updated.amount,
        batchId,
        batchStatus,
      },
      ip,
      result: 'Success',
    });

    if (nextStatus === 'failed') {
      const partner = getPartner(updated.partnerId);
      alertPayoutFailed({
        payoutId,
        amount: updated.amount,
        partnerId: partner?._id ? String(partner._id) : undefined,
        partnerName: partner?.name,
        batchId,
      });
    }

    return updated;
  }

  /**
   * Backwards-compatible method for callers that specifically mark paid.
   */
  async markPaid(input: {
    payoutId: string;
    adminId: string;
    ip: string;
  }) {
    return this.updateStatus({
      ...input,
      status: 'paid',
    });
  }

  async exportCsv(batchId?: string): Promise<string> {
    if (batchId && !isObjectId(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'Invalid payout batch ID',
      );
    }

    if (this.demoMode) {
      if (batchId) {
        const batch = await this.repository.findBatchById(batchId);

        if (!batch) {
          throw new AppError(
            404,
            'PAYOUT_BATCH_NOT_FOUND',
            'Payout batch not found',
          );
        }

        const rawPayouts = await this.repository.listPayouts(batchId);
        const payouts = rawPayouts as PayoutRecord[];

        return buildCsv([
          CSV_HEADERS,
          ...payouts.map(payoutToCsvRow),
        ]);
      }

      const rawBatches = await this.repository.listBatches({
        page: 1,
        limit: 100,
      });

      const batchResult = rawBatches as {
        items?: Array<{ _id: Types.ObjectId | string }>;
      };

      const batches = batchResult.items ?? [];
      const allPayouts: PayoutRecord[] = [];

      for (const batch of batches) {
        const rawPayouts = await this.repository.listPayouts(
          String(batch._id),
        );

        allPayouts.push(...(rawPayouts as PayoutRecord[]));
      }

      return buildCsv([
        CSV_HEADERS,
        ...allPayouts.map(payoutToCsvRow),
      ]);
    }

    const filter: Record<string, unknown> = {};

    if (batchId) {
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

    return buildCsv([
      CSV_HEADERS,
      ...payouts.map(payoutToCsvRow),
    ]);
  }
}

/*
 * Demo mode is enabled only when both environment flags are set.
 * Demo audit is intentionally a no-op so local demo changes don't
 * create audit documents in the shared database.
 */
const payoutsDemoMode =
  process.env.NODE_ENV === 'development' &&
  process.env.PAYOUTS_DEMO_MODE === 'true';

const demoAudit: AuditDependency = {
  recordAudit: async () => undefined,
};

export const payoutsService = payoutsDemoMode
  ? new PayoutsService(
      payoutsDemoRepository,
      demoAudit,
      true,
    )
  : new PayoutsService();

export default payoutsService;
