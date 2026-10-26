
import type { Request, Response } from 'express';

import { getAuthUser } from '../../middleware/auth.middleware';
import { payoutsService } from './payouts.service';

interface PayoutBatchListResult {
  items: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

function getIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export class PayoutsController {
  async generate(req: Request, res: Response) {
    const admin = getAuthUser(req);

    const batch = await payoutsService.generateBatch({
      periodStart: String(req.body.periodStart ?? ''),
      periodEnd: String(req.body.periodEnd ?? ''),
      adminId: admin.id,
      ip: getIp(req),
    });

    res.status(201).json({
      success: true,
      data: batch,
    });
  }

  async list(req: Request, res: Response) {
    const result = (await payoutsService.listBatches({
      page:
        typeof req.query.page === 'string'
          ? Number(req.query.page)
          : undefined,
      limit:
        typeof req.query.limit === 'string'
          ? Number(req.query.limit)
          : undefined,
      status:
        typeof req.query.status === 'string'
          ? req.query.status
          : undefined,
    })) as PayoutBatchListResult;

    res.status(200).json({
      success: true,
      data: result.items,
      meta: result.pagination,
    });
  }

  async getBatch(req: Request, res: Response) {
    const batch = await payoutsService.getBatch(req.params.id);

    res.status(200).json({
      success: true,
      data: batch,
    });
  }

  async listBatchPayouts(req: Request, res: Response) {
    const payouts = await payoutsService.listPayouts(req.params.id);

    res.status(200).json({
      success: true,
      data: payouts,
    });
  }

  /**
   * Update an individual payout's status.
   * The service validates the requested status and transition.
   */
  async updateStatus(req: Request, res: Response) {
    const admin = getAuthUser(req);

    const payout = await payoutsService.updateStatus({
      payoutId: req.params.id,
      status: req.body.status,
      adminId: admin.id,
      ip: getIp(req),
    });

    res.status(200).json({
      success: true,
      data: payout,
    });
  }

  /**
   * Mark an individual payout as paid.
   * Retained for compatibility with any existing callers.
   */
  async markPaid(req: Request, res: Response) {
    const admin = getAuthUser(req);

    const payout = await payoutsService.markPaid({
      payoutId: req.params.id,
      adminId: admin.id,
      ip: getIp(req),
    });

    res.status(200).json({
      success: true,
      data: payout,
    });
  }

  async exportCsv(req: Request, res: Response) {
    const batchId =
      typeof req.query.batchId === 'string'
        ? req.query.batchId
        : undefined;

    const csv = await payoutsService.exportCsv(batchId);

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homecarex-payouts${batchId ? `-${batchId}` : ''}.csv"`,
    );
    res.send(csv);
  }
}

export const payoutsController = new PayoutsController();

export default payoutsController;
