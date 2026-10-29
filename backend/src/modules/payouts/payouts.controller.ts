import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';

import { payoutsService } from './payouts.service';

const getIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown';

const num = (value: unknown): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

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

    res.send(csv);
  },
};

export default payoutsController;