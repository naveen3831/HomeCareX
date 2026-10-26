import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { payoutsService, PayoutsService } from './payouts.service';

const getIp = (req: Request): string => req.ip || req.socket?.remoteAddress || 'unknown';
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export class PayoutsController {
  constructor(private readonly service: PayoutsService = payoutsService) {}

  /** POST /admin/payout-batches or /admin/payouts */
  generate = async (req: Request, res: Response): Promise<void> => {
    const admin = getAuthUser(req);
    const batch = await this.service.generateBatch({
      periodStart: req.body?.periodStart,
      periodEnd: req.body?.periodEnd,
      adminId: admin.id,
      ip: getIp(req),
    });
    sendSuccess(res, batch, { status: 201 });
  };

  /** GET /admin/payout-batches or /admin/payouts */
  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  };

  /** GET /admin/payout-batches/:id or /admin/payouts/:id */
  get = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getBatch(String(req.params.id)));
  };

  getBatch = async (req: Request, res: Response): Promise<void> => {
    return this.get(req, res);
  };

  /** GET /admin/payout-batches/:id/payouts or /admin/payouts/:id/payouts */
  listPayouts = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.listPayouts(String(req.params.id)));
  };

  /** PATCH /admin/payouts/:id/mark-paid or PATCH /admin/payouts/:id */
  markPaid = async (req: Request, res: Response): Promise<void> => {
    const admin = getAuthUser(req);
    sendSuccess(
      res,
      await this.service.markPaid({
        payoutId: String(req.params.id),
        adminId: admin.id,
        ip: getIp(req),
        transactionId: str(req.body?.transactionId),
      }),
    );
  };

  /** GET /admin/payout-batches/:id/export or /admin/payouts/:id/export */
  exportCsv = async (req: Request, res: Response): Promise<void> => {
    const { csv, filename } = await this.service.exportCsv(String(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  };
}

export const payoutsController = new PayoutsController();
export default payoutsController;
