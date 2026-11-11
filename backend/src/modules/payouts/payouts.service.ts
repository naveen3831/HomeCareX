import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import PayoutModel from '../../models/Payout';
import PayoutBatchModel from '../../models/PayoutBatch';
import {
  auditService,
  type AuditService,
} from '../audit/audit.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PAYOUT_BATCH_STATUSES,
} from './payouts.constants';
import { payoutsRepository } from './payouts.repository';
import { alertPayoutFailed } from '../notifications/admin-alerts';
import type {
  ConfirmBatchInput,
  GenerateBatchInput,
  ListBatchesInput,
  MarkPaidInput,
  PayoutsRepository,
} from './payouts.types';
import { isObjectId, parseDate } from './payouts.validation';
import { isPayoutFrequency, parseAnchorDate, resolvePayoutPeriod } from './payouts.calc';

type RepositoryPort = Omit<
  PayoutsRepository,
  'markPaid' | 'getPayoutDetails' | 'confirmBatch' | 'summary'
> &
  Partial<Pick<PayoutsRepository, 'markPaid' | 'getPayoutDetails' | 'confirmBatch' | 'summary'>>;

type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

interface PartnerInfo {
  _id?: unknown;
  name?: string;
  email?: string;
}

interface BatchInfo {
  periodStart?: Date | string;
  periodEnd?: Date | string;
}

interface PayoutDocument {
  _id: unknown;
  partnerId: unknown;
  batchId: unknown;
  amount: number;
  status: PayoutStatus;
  method?: string | null;
  transactionId?: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
}

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['processing', 'failed', 'paid'],
  processing: ['failed', 'paid'],
  failed: ['processing'],
  paid: [],
};

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

function idToString(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value
  ) {
    return String(value._id ?? '');
  }

  return String(value ?? '');
}

function getPartner(value: unknown): PartnerInfo | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    ('name' in value || '_id' in value || 'email' in value)
  ) {
    return value as PartnerInfo;
  }

  return null;
}

function getBatchInfo(value: unknown): BatchInfo | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    ('periodStart' in value || 'periodEnd' in value)
  ) {
    return value as BatchInfo;
  }

  return null;
}

function toIsoString(
  value: Date | string | null | undefined,
): string {
  if (value == null) return '';

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** Quote CSV cells and protect spreadsheet users from formula injection. */
export function escapeCsv(value: unknown): string {
  let text =
    value == null
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  if (typeof value !== 'number' && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: unknown[][]): string {
  return rows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
}

/**
 * Converts a payout into a CSV row.
 *
 * Batch dates are taken from the populated batch reference first,
 * then from the separately loaded batch-date map.
 */
function payoutToCsvRow(
  payout: PayoutDocument,
  batchDates: Map<string, BatchInfo> = new Map(),
): unknown[] {
  const partner = getPartner(payout.partnerId);
  const populatedBatch = getBatchInfo(payout.batchId);
  const batchId = idToString(payout.batchId);
  const fallbackBatch = batchDates.get(batchId);

  // Fall back per field in case only one date is populated.
  const batch: BatchInfo = {
    periodStart:
      populatedBatch?.periodStart ?? fallbackBatch?.periodStart,
    periodEnd:
      populatedBatch?.periodEnd ?? fallbackBatch?.periodEnd,
  };

  return [
    idToString(payout._id),
    idToString(payout.partnerId),
    partner?.name ?? '',
    partner?.email ?? '',
    batchId,
    toIsoString(batch.periodStart),
    toIsoString(batch.periodEnd),
    Number(payout.amount).toFixed(2),
    payout.status,
    toIsoString(payout.paidAt),
    toIsoString(payout.createdAt),
  ];
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

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'An unexpected payout error occurred';
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  const code = getErrorCode(error);

  if (code === 'INVALID_ADMIN_ID') {
    throw new AppError(401, code, 'A valid admin ID is required');
  }

  if (
    code === 'INVALID_PERIOD' ||
    code === 'INVALID_PAYOUT_PERIOD'
  ) {
    throw new AppError(400, code, 'Enter a valid payout period');
  }

  if (
    code === 'NO_ELIGIBLE_EARNINGS' ||
    code === 'NO_EARNINGS_TO_PAY'
  ) {
    throw new AppError(
      422,
      code,
      'There are no pending earnings in this period',
    );
  }

  if (
    code === 'PAYOUT_BATCH_ALREADY_EXISTS' ||
    code === 'PAYOUT_EARNINGS_RESERVATION_CONFLICT'
  ) {
    throw new AppError(
      409,
      code,
      'A payout batch already exists or the earnings are already reserved',
    );
  }

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
    throw new AppError(400, code, 'Invalid payout status');
  }

  throw new AppError(
    500,
    'PAYOUT_OPERATION_FAILED',
    getErrorMessage(error),
  );
}

function isPayoutStatus(value: unknown): value is PayoutStatus {
  return (
    value === 'pending' ||
    value === 'processing' ||
    value === 'paid' ||
    value === 'failed'
  );
}

export class PayoutsService {
  constructor(
    private readonly repository: RepositoryPort = payoutsRepository,
    private readonly audit: Pick<AuditService, 'recordAudit'> =
      auditService,
  ) {}

  private requireAdmin(adminId: string): void {
    if (!isObjectId(adminId)) {
      throw new AppError(
        401,
        'INVALID_ADMIN_ID',
        'A valid admin ID is required',
      );
    }
  }

  private requireBatchId(batchId: string): void {
    if (!isObjectId(batchId)) {
      throw new AppError(
        400,
        'INVALID_BATCH_ID',
        'A valid payout batch ID is required',
      );
    }
  }

  private async record(
    input: Parameters<AuditService['recordAudit']>[0],
  ): Promise<void> {
    try {
      await this.audit.recordAudit(input);
    } catch (error) {
      // Audit failure should not mask a completed payout operation.
      console.error('[payouts] Audit log failed', error);
    }
  }

  /**
   * Who was paid and for which services, as flat strings the audit screen can show.
   * Best effort: a lookup problem must never block or fail the payout itself.
   */
  private async describePayout(payoutId: string): Promise<Record<string, string | number>> {
    try {
      if (!this.repository.getPayoutDetails) return {};

      const d = (await this.repository.getPayoutDetails(payoutId)) as {
        payout?: { batchId?: string };
        partner?: { id?: string; name?: string };
        days?: { services: { serviceName: string; bookingId: string; net: number }[] }[];
      };
      const services = (d.days ?? []).flatMap((day) => day.services);

      return {
        partner: `${d.partner?.name ?? 'Unknown partner'} (${d.partner?.id ?? '-'})`,
        batchId: d.payout?.batchId ?? '',
        servicesCount: services.length,
        services: services
          .map((svc) => `${svc.serviceName} (booking ${svc.bookingId}, Rs ${svc.net})`)
          .join('; '),
      };
    } catch (error) {
      console.error('[payouts] Could not describe payout for audit', error);
      return {};
    }
  }

  /** "Name Rs 100; Other Rs 50" for the partners of a batch that were still unpaid. */
  private async describeBatchPartners(batchId: string, onlyIds?: Set<string>): Promise<Record<string, string | number>> {
    try {
      const rows = (await this.repository.listPayouts(batchId)) as unknown as {
        _id: unknown;
        partnerId: { name?: string } | string | null;
        amount: number;
        servicesCount?: number;
      }[];
      const picked = onlyIds ? rows.filter((row) => onlyIds.has(idToString(row._id))) : rows;

      return {
        partners: picked
          .map((row) => {
            const name = row.partnerId && typeof row.partnerId === 'object' ? row.partnerId.name : undefined;
            return `${name ?? 'Partner'} Rs ${row.amount} (${row.servicesCount ?? 0} services)`;
          })
          .join('; '),
      };
    } catch (error) {
      console.error('[payouts] Could not describe batch partners for audit', error);
      return {};
    }
  }

  /**
   * Loads batch period dates from MongoDB for payout references
   * that are not populated or do not contain period dates.
   */
  private async loadBatchDates(
    payouts: PayoutDocument[],
  ): Promise<Map<string, BatchInfo>> {
    const batchIds = [
      ...new Set(
        payouts
          .map((payout) => idToString(payout.batchId))
          .filter(
            (id) =>
              id.length > 0 &&
              Types.ObjectId.isValid(id),
          ),
      ),
    ];

    const batchDates = new Map<string, BatchInfo>();

    if (batchIds.length === 0) {
      return batchDates;
    }

    const objectIds = batchIds.map(
      (id) => new Types.ObjectId(id),
    );

    const batches = await PayoutBatchModel.find({
      _id: { $in: objectIds },
    })
      .select('_id periodStart periodEnd')
      .lean()
      .exec();

    for (const batch of batches) {
      batchDates.set(String(batch._id), {
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
      });
    }

    return batchDates;
  }

  async generateBatch(input: GenerateBatchInput) {
    this.requireAdmin(input.adminId);

    const frequency = input.frequency === undefined || input.frequency === '' ? 'custom' : input.frequency;

    if (!isPayoutFrequency(frequency)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_FREQUENCY',
        'Frequency must be daily, weekly, monthly or custom',
      );
    }

    let periodStart: Date | null;
    let periodEnd: Date | null;

    if (frequency === 'custom') {
      periodStart =
        input.periodStart instanceof Date ? input.periodStart : parseDate(input.periodStart);
      periodEnd =
        input.periodEnd instanceof Date ? input.periodEnd : parseDate(input.periodEnd);
    } else {
      // Daily / weekly / monthly: the server decides the boundaries (IST), so "today" is always payable.
      const anchor = parseAnchorDate(input.date);

      if (!anchor) {
        throw new AppError(400, 'INVALID_PAYOUT_PERIOD', 'Enter a valid date (YYYY-MM-DD)');
      }

      ({ start: periodStart, end: periodEnd } = resolvePayoutPeriod(frequency, anchor));
    }

    if (
      !periodStart ||
      !periodEnd ||
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime())
    ) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_PERIOD',
        'Enter valid payout period dates',
      );
    }

    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_PERIOD',
        'The period start must be before the period end',
      );
    }

    try {
      const batch = await this.repository.generateBatch({
        periodStart,
        periodEnd,
        adminId: input.adminId,
        frequency,
      });

      await this.record({
        actor: input.adminId,
        action: 'PAYOUT_BATCH_GENERATED',
        entity: 'PayoutBatch',
        entityId: idToString(batch._id),
        after: {
          frequency,
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

      return batch;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  /** Totals across every batch (failed batches excluded). */
  async getSummary() {
    if (!this.repository.summary) {
      throw new AppError(501, 'NOT_SUPPORTED', 'Payout summary is not supported by this repository');
    }

    return this.repository.summary();
  }

  async listBatches(input: ListBatchesInput = {}) {
    const page = input.page ?? DEFAULT_PAGE;
    const limit = input.limit ?? DEFAULT_LIMIT;

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        400,
        'INVALID_PAGE',
        'Page must be a whole number of 1 or more',
      );
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_LIMIT
    ) {
      throw new AppError(
        400,
        'INVALID_LIMIT',
        `Limit must be between 1 and ${MAX_LIMIT}`,
      );
    }

    if (
      input.status !== undefined &&
      !(PAYOUT_BATCH_STATUSES as readonly string[]).includes(
        input.status,
      )
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
      status: input.status,
    });
  }

  async getBatch(batchId: string) {
    this.requireBatchId(batchId);

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

  async markPaid(input: MarkPaidInput) {
    this.requireAdmin(input.adminId);

    if (!isObjectId(input.payoutId)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_ID',
        'A valid payout ID is required',
      );
    }

    if (!this.repository.markPaid) {
      throw new AppError(
        501,
        'NOT_SUPPORTED',
        'Marking payouts as paid is not supported by this repository',
      );
    }

    try {
      const payout = await this.repository.markPaid({
        payoutId: input.payoutId,
        transactionId: input.transactionId,
        adminId: input.adminId,
      });

      await this.record({
        actor: input.adminId,
        action: 'PAYOUT_MARKED_PAID',
        entity: 'Payout',
        entityId: input.payoutId,
        after: {
          status: payout.status,
          amount: payout.amount,
          paidAt: payout.paidAt,
          transactionId: input.transactionId,
          ...(await this.describePayout(input.payoutId)),
        },
        ip: input.ip,
        result: 'Success',
      });

      return payout;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  /** One payout with its services grouped day by day. */
  async getPayoutDetails(payoutId: string) {
    if (!isObjectId(payoutId)) {
      throw new AppError(400, 'INVALID_PAYOUT_ID', 'A valid payout ID is required');
    }

    if (!this.repository.getPayoutDetails) {
      throw new AppError(501, 'NOT_SUPPORTED', 'Payout details are not supported by this repository');
    }

    try {
      return await this.repository.getPayoutDetails(payoutId);
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  /**
   * Weekly "Confirm payment": pays every unpaid payout in the batch, credits each partner's wallet
   * and records commission / payout in the admin wallet.
   */
  async confirmBatch(input: ConfirmBatchInput) {
    this.requireAdmin(input.adminId);
    this.requireBatchId(input.batchId);

    if (!this.repository.confirmBatch) {
      throw new AppError(501, 'NOT_SUPPORTED', 'Batch confirmation is not supported by this repository');
    }

    try {
      const unpaidBefore = await this.repository
        .listPayouts(input.batchId)
        .then(
          (rows) =>
            new Set(
              (rows as unknown as { _id: unknown; status: string }[])
                .filter((row) => row.status !== 'paid')
                .map((row) => idToString(row._id)),
            ),
        )
        .catch(() => undefined);

      const result = await this.repository.confirmBatch({
        batchId: input.batchId,
        adminId: input.adminId,
      });

      await this.record({
        actor: input.adminId,
        action: 'PAYOUT_BATCH_CONFIRMED',
        entity: 'PayoutBatch',
        entityId: input.batchId,
        after: {
          status: result.batch?.status,
          confirmedCount: result.confirmedCount,
          confirmedAmount: result.confirmedAmount,
          failedCount: result.failed.length,
          ...(await this.describeBatchPartners(input.batchId, unpaidBefore)),
        },
        ip: input.ip,
        result: result.failed.length ? 'Failed' : 'Success',
      });

      return result;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  /**
   * Changes a payout status with transition validation.
   * Used by admin workflows that support the full status lifecycle.
   */
  async updateStatus(input: {
    payoutId: string;
    status: unknown;
    adminId: string;
    ip: string;
  }) {
    const { payoutId, status, adminId, ip } = input;

    if (!isObjectId(payoutId)) {
      throw new AppError(400, 'INVALID_PAYOUT_ID', 'Invalid payout ID');
    }

    this.requireAdmin(adminId);

    if (!isPayoutStatus(status)) {
      throw new AppError(
        400,
        'INVALID_PAYOUT_STATUS',
        'Status must be pending, processing, paid, or failed',
      );
    }

    const nextStatus = status;

    const beforeResult = await PayoutModel.findById(payoutId).lean();
    const before = beforeResult as unknown as PayoutDocument | null;

    if (!before) {
      throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found');
    }

    if (before.status === nextStatus) {
      throw new AppError(
        409,
        before.status === 'paid'
          ? 'PAYOUT_ALREADY_PAID'
          : 'PAYOUT_STATUS_CONFLICT',
        `Payout is already in ${nextStatus} status`,
      );
    }

    if (!allowedTransitions[before.status]?.includes(nextStatus)) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        `Cannot change payout status from ${before.status} to ${nextStatus}`,
      );
    }

    const updatedResult = await PayoutModel.findOneAndUpdate(
      { _id: payoutId, status: before.status },
      {
        $set: {
          status: nextStatus,
          paidAt: nextStatus === 'paid' ? new Date() : null,
        },
      },
      { new: true, runValidators: true },
    )
      .populate('partnerId', 'name email')
      .populate('batchId', 'periodStart periodEnd status')
      .lean();

    const updated = updatedResult as unknown as PayoutDocument | null;

    if (!updated) {
      throw new AppError(
        409,
        'PAYOUT_STATUS_CONFLICT',
        'The payout changed concurrently. Refresh and try again.',
      );
    }

    const batchId = idToString(before.batchId);

    if (Types.ObjectId.isValid(batchId)) {
      const batchObjectId = new Types.ObjectId(batchId);

      const remaining = await PayoutModel.countDocuments({
        batchId: batchObjectId,
        status: { $ne: 'paid' },
      });

      let batchStatus = 'pending';

      if (remaining === 0) {
        batchStatus = 'completed';
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: 'processing',
        })
      ) {
        batchStatus = 'processing';
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: 'paid',
        })
      ) {
        batchStatus = 'processing';
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: 'failed',
        })
      ) {
        batchStatus = 'failed';
      }

      await PayoutBatchModel.findByIdAndUpdate(batchObjectId, {
        $set: { status: batchStatus },
      });
    }

    await this.record({
      actor: adminId,
      action:
        nextStatus === 'paid'
          ? 'PAYOUT_MARKED_PAID'
          : 'PAYOUT_STATUS_UPDATED',
      entity: 'Payout',
      entityId: payoutId,
      before: {
        status: before.status,
        paidAt: before.paidAt ?? null,
        amount: before.amount,
      },
      after: {
        status: updated.status,
        paidAt: updated.paidAt ?? null,
        amount: updated.amount,
        batchId,
      },
      ip,
      result: 'Success',
    });

    if (nextStatus === 'failed') {
      const partner = getPartner(updated.partnerId);

      alertPayoutFailed({
        payoutId,
        amount: updated.amount,
        partnerId: partner?._id
          ? String(partner._id)
          : undefined,
        partnerName: partner?.name,
        batchId,
      });
    }

    return updated;
  }

  /**
   * Exports a specific batch as CSV.
   * A missing batch ID exports all batches' payouts.
   */
  async exportCsv(
    batchId?: string,
  ): Promise<string | { csv: string; filename: string }> {
    if (batchId) {
      this.requireBatchId(batchId);
      await this.getBatch(batchId);
    }

    const filter: Record<string, unknown> = {};

    if (batchId) {
      filter.batchId = new Types.ObjectId(batchId);
    }

    const results = await PayoutModel.find(filter)
      .populate('partnerId', 'name email')
      .populate('batchId', 'periodStart periodEnd status')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const payouts = results as unknown as PayoutDocument[];

    // Load batch dates as a fallback if population is incomplete.
    const batchDates = await this.loadBatchDates(payouts);

    return {
      csv: buildCsv([
        CSV_HEADERS,
        ...payouts.map((payout) =>
          payoutToCsvRow(payout, batchDates),
        ),
      ]),
      filename: batchId ? `payouts-${batchId}.csv` : 'payouts.csv',
    };
  }
}

export const payoutsService = new PayoutsService();

export default payoutsService;