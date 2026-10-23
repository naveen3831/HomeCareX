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
