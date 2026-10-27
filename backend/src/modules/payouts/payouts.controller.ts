<<<<<<< HEAD

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
=======
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { payoutsService } from './payouts.service';

const getIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export const payoutsController = {
  /** POST /admin/payout-batches or /admin/payouts  { periodStart, periodEnd } */
  async generate(req: Request, res: Response) {
    const admin = getAuthUser(req);
    const batch = await payoutsService.generateBatch({
      periodStart: req.body?.periodStart,
      periodEnd: req.body?.periodEnd,
      adminId: admin.id,
      ip: getIp(req),
    });
    sendSuccess(res, batch, { status: 201 });
  },

  /** GET /admin/payout-batches or /admin/payouts?page&limit&status */
  async list(req: Request, res: Response) {
    const result = await payoutsService.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  },

  /** GET /admin/payout-batches/:id or /admin/payouts/:id */
  async get(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.getBatch(String(req.params.id)));
  },

  async getBatch(req: Request, res: Response) {
    return this.get(req, res);
  },

  /** GET /admin/payout-batches/:id/payouts or /admin/payouts/:id/payouts */
  async listPayouts(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.listPayouts(String(req.params.id)));
  },

  /** PATCH /admin/payouts/:id/mark-paid or PATCH /admin/payouts/:id  { transactionId? } */
  async markPaid(req: Request, res: Response) {
    const admin = getAuthUser(req);
    sendSuccess(
      res,
      await payoutsService.markPaid({
        payoutId: String(req.params.id),
        adminId: admin.id,
        ip: getIp(req),
        transactionId: str(req.body?.transactionId),
      }),
    );
  },

  /** GET /admin/payout-batches/:id/export or /admin/payouts/:id/export (CSV download) */
  async exportCsv(req: Request, res: Response) {
    const { csv, filename } = await payoutsService.exportCsv(String(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  },
};
>>>>>>> origin/develop

export default payoutsController;
