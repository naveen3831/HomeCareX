import type { Request, Response } from 'express';

import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';

import { payoutsService } from './payouts.service';

const getIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown';

const num = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const payoutsController = {
  /**
   * POST /admin/payouts
   * POST /admin/payout-batches
   *
   * Generate a payout batch.
   */
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

  /**
   * GET /admin/payouts?page&limit&status
   * GET /admin/payout-batches?page&limit&status
   *
   * List payout batches.
   */
  async list(req: Request, res: Response) {
    const result = await payoutsService.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });

    sendSuccess(res, result.items, {
      meta: {
        pagination: result.pagination,
      },
    });
  },

  /**
   * GET /admin/payouts/:id
   * GET /admin/payout-batches/:id
   *
   * Get a payout batch.
   */
  async get(req: Request, res: Response) {
    sendSuccess(
      res,
      await payoutsService.getBatch(String(req.params.id)),
    );
  },

  /**
   * Compatibility alias for routes using getBatch.
   */
  async getBatch(req: Request, res: Response) {
    return payoutsController.get(req, res);
  },

  /**
   * GET /admin/payouts/:id/payouts
   * GET /admin/payout-batches/:id/payouts
   *
   * List payouts belonging to a batch.
   */
  async listPayouts(req: Request, res: Response) {
    sendSuccess(
      res,
      await payoutsService.listPayouts(String(req.params.id)),
    );
  },

  /** Alias of listPayouts. */
  async listBatchPayouts(req: Request, res: Response) {
    return payoutsController.listPayouts(req, res);
  },

  /**
   * PATCH /admin/payouts/:id/mark-paid
   * PATCH /admin/payouts/:id
   *
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

  /**
   * Compatibility alias for routes using updateStatus.
   */
  async updateStatus(req: Request, res: Response) {
    return payoutsController.markPaid(req, res);
  },

  /**
   * CSV download.
   * GET /admin/payouts/export?batchId=<batchId>
   * GET /admin/payouts/:id/export
   * GET /admin/payout-batches/:id/export
   *
   * Export a batch's payouts as CSV.
   */
  async exportCsv(req: Request, res: Response) {
    const batchId =
      str(req.params.id) ?? str(req.query.batchId);

    if (!batchId) {
      res.status(400).json({
        success: false,
        message: 'batchId is required to export payouts',
      });
      return;
    }

    const exported = await payoutsService.exportCsv(batchId);

    const csv =
      typeof exported === 'string'
        ? exported
        : exported.csv;

    const filename =
      typeof exported === 'string'
        ? `payouts-${batchId}.csv`
        : exported.filename;

    res.status(200);
    res.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    res.send(csv);
  },
};

export default payoutsController;