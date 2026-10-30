import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { payoutsService } from './payouts.service';

const getIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown';

const num = (value: unknown): number | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const payoutsController = {
  /** POST /admin/payouts or /admin/payout-batches  { periodStart, periodEnd } */
  async generate(req: Request, res: Response) {
    const admin = getAuthUser(req);

    const batch = await payoutsService.generateBatch({
      periodStart: String(req.body?.periodStart ?? ''),
      periodEnd: String(req.body?.periodEnd ?? ''),
      adminId: admin.id,
      ip: getIp(req),
    });

    sendSuccess(res, batch, { status: 201 });
  },

  /** GET /admin/payouts or /admin/payout-batches ?page&limit&status */
  async list(req: Request, res: Response) {
    const result = await payoutsService.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });

    sendSuccess(res, result.items, {
      meta: { pagination: result.pagination },
    });
  },

  /** GET /admin/payouts/:id or /admin/payout-batches/:id */
  async getBatch(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.getBatch(String(req.params.id)));
  },

  /** Alias of getBatch. */
  async get(req: Request, res: Response) {
    return payoutsController.getBatch(req, res);
  },

  /** GET /admin/payouts/:id/payouts or /admin/payout-batches/:id/payouts */
  async listPayouts(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.listPayouts(String(req.params.id)));
  },

  /** Alias of listPayouts. */
  async listBatchPayouts(req: Request, res: Response) {
    return payoutsController.listPayouts(req, res);
  },

  /**
   * PATCH /admin/payouts/:id or /admin/payouts/:id/mark-paid  { transactionId? }
   * Mark an individual payout as paid.
   */
  async markPaid(req: Request, res: Response) {
    const admin = getAuthUser(req);

    const payout = await payoutsService.markPaid({
      payoutId: String(req.params.id),
      adminId: admin.id,
      ip: getIp(req),
      transactionId: str(req.body?.transactionId),
    });

    sendSuccess(res, payout);
  },

  /** Alias of markPaid. */
  async updateStatus(req: Request, res: Response) {
    return payoutsController.markPaid(req, res);
  },

  /**
   * GET /admin/payouts/export?batchId=<id>
   * GET /admin/payouts/:id/export, /admin/payout-batches/:id/export
   * Without a batch id, exports every batch's payouts.
   */
  async exportCsv(req: Request, res: Response) {
    const batchId = str(req.params.id) ?? str(req.query.batchId);
    const result = await payoutsService.exportCsv(batchId);

    const csv = typeof result === 'string' ? result : result.csv;
    const filename =
      typeof result === 'string' ? 'payouts.csv' : result.filename;

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  },
};

export default payoutsController;
