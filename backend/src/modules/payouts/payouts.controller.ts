
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
