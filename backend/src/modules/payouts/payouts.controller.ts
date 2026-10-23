import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { payoutsService } from './payouts.service';

const getIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export const payoutsController = {
  /** POST /admin/payout-batches  { periodStart, periodEnd } */
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

  /** GET /admin/payout-batches?page&limit&status */
  async list(req: Request, res: Response) {
    const result = await payoutsService.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  },

  /** GET /admin/payout-batches/:id */
  async get(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.getBatch(String(req.params.id)));
  },

  /** GET /admin/payout-batches/:id/payouts */
  async listPayouts(req: Request, res: Response) {
    sendSuccess(res, await payoutsService.listPayouts(String(req.params.id)));
  },

  /** PATCH /admin/payouts/:id/mark-paid  { transactionId? } */
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

  /** GET /admin/payout-batches/:id/export  (CSV download) */
  async exportCsv(req: Request, res: Response) {
    const { csv, filename } = await payoutsService.exportCsv(String(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  },
};
