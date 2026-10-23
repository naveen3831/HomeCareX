import { AppError } from '../../utils/AppError';
import { PAYOUT_BATCH_STATUSES } from '../../models/PayoutBatch';
import { auditService } from '../audit/audit.service';
import { payoutsRepository } from './payouts.repository';

const objectIdPattern = /^[a-f\d]{24}$/i;

export function escapeCsv(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

type PayoutRepository = {
  generateBatch(input: { periodStart: Date; periodEnd: Date; adminId: string }): Promise<unknown>;
  listBatches(input: { page: number; limit: number; status?: string }): Promise<unknown>;
  findBatchById(batchId: string): Promise<unknown | null>;
  listPayouts(batchId: string): Promise<unknown[]>;
  markPaid?(payoutId: string): Promise<unknown | null>;
  exportPayouts?(batchId?: string): Promise<Record<string, unknown>[]>;
};

type AuditWriter = Pick<typeof auditService, 'recordAudit'>;

export class PayoutsService {
  constructor(
    private readonly repository: PayoutRepository = payoutsRepository,
    private readonly audit: AuditWriter = auditService,
  ) {}

  async generateBatch(input: {
    periodStart: string;
    periodEnd: string;
    adminId: string;
    ip: string;
  }) {
    if (!objectIdPattern.test(input.adminId)) {
      throw new AppError(401, 'INVALID_ADMIN_ID', 'A valid admin ID is required.');
    }
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime()) ||
      periodStart.getTime() >= periodEnd.getTime()
    ) {
      throw new AppError(400, 'INVALID_PAYOUT_PERIOD', 'The payout period must have a valid start before its end.');
    }
    const batch = await this.repository.generateBatch({
      periodStart,
      periodEnd,
      adminId: input.adminId,
    });
    await this.audit.recordAudit({
      actor: input.adminId,
      action: 'payout.batch.generated',
      entity: 'payout_batch',
      entityId: String((batch as { _id?: unknown })._id ?? ''),
      before: null,
      after: batch,
      ip: input.ip,
      result: 'Success',
    });
    return batch;
  }

  async listBatches(input: { page?: number; limit?: number; status?: string } = {}) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(400, 'INVALID_PAGE', 'Page must be a positive integer.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError(400, 'INVALID_LIMIT', 'Limit must be an integer between 1 and 100.');
    }
    if (input.status && !(PAYOUT_BATCH_STATUSES as readonly string[]).includes(input.status)) {
      throw new AppError(400, 'INVALID_BATCH_STATUS', 'Unsupported payout batch status.');
    }
    return this.repository.listBatches({ page, limit, status: input.status });
  }

  async getBatch(batchId: string) {
    if (!objectIdPattern.test(batchId)) {
      throw new AppError(400, 'INVALID_BATCH_ID', 'A valid batch ID is required.');
    }
    return this.repository.findBatchById(batchId);
  }

  async listPayouts(batchId: string) {
    if (!objectIdPattern.test(batchId)) {
      throw new AppError(400, 'INVALID_BATCH_ID', 'A valid batch ID is required.');
    }
    return this.repository.listPayouts(batchId);
  }

  async markPaid(input: { payoutId: string; adminId: string; ip: string }) {
    if (!objectIdPattern.test(input.payoutId)) {
      throw new AppError(400, 'INVALID_PAYOUT_ID', 'A valid payout ID is required.');
    }
    if (!objectIdPattern.test(input.adminId)) {
      throw new AppError(401, 'INVALID_ADMIN_ID', 'A valid admin ID is required.');
    }
    if (!this.repository.markPaid) {
      throw new AppError(501, 'PAYOUT_UPDATE_UNAVAILABLE', 'Payout updates are not configured.');
    }
    const payout = await this.repository.markPaid(input.payoutId);
    if (!payout) throw new AppError(404, 'PAYOUT_NOT_FOUND', 'Payout not found.');
    await this.audit.recordAudit({
      actor: input.adminId,
      action: 'payout.paid',
      entity: 'payout',
      entityId: input.payoutId,
      before: null,
      after: payout,
      ip: input.ip,
      result: 'Success',
    });
    return payout;
  }

  async exportCsv(batchId: string) {
    if (!objectIdPattern.test(batchId)) {
      throw new AppError(400, 'INVALID_BATCH_ID', 'A valid batch ID is required.');
    }
    if (!this.repository.exportPayouts) {
      throw new AppError(501, 'PAYOUT_EXPORT_UNAVAILABLE', 'Payout exports are not configured.');
    }
    const rows = await this.repository.exportPayouts(batchId);
    const columns = ['partnerName', 'partnerEmail', 'gross', 'commission', 'amount', 'status', 'paidAt'];
    return [columns.map(escapeCsv).join(','), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(','))].join('\r\n');
  }
}

export const payoutsService = new PayoutsService();
