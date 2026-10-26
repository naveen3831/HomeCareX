
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { AppError } from '../../utils/AppError';
import { PayoutsService } from './payouts.service';

export class PayoutsController {
  constructor(private readonly service = new PayoutsService()) {}

  async list(req: Request, res: Response): Promise<void> {
    const result = await this.service.listBatches({
      page: req.query.page === undefined ? undefined : Number(req.query.page),
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });

    res.status(200).json({ success: true, data: result });
  }

  async generate(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { periodStart, periodEnd } = req.body ?? {};

    const result = await this.service.generateBatch({
      periodStart,
      periodEnd,
      adminId: user.id,
      ip: req.ip || 'unknown',
    });

    res.status(201).json({ success: true, data: result });
  }

  async getBatch(req: Request, res: Response): Promise<void> {
    const result = await this.service.getBatch(req.params.id);
    res.status(200).json({ success: true, data: result });
  }

  async listPayouts(req: Request, res: Response): Promise<void> {
    const result = await this.service.listPayouts(req.params.id);
    res.status(200).json({ success: true, data: result });
  }

  async markPaid(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    const result = await this.service.markPaid({
      payoutId: req.params.id,
      adminId: user.id,
      ip: req.ip || 'unknown',
    });

    res.status(200).json({ success: true, data: result });
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await this.service.exportCsv(req.params.id);

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payouts-${req.params.id}.csv"`,
    );
    res.send(csv);
  }
}

export const payoutsController = new PayoutsController();
export default payoutsController;
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
