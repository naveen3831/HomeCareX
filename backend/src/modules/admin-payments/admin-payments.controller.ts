import type { Request, Response } from 'express';
import { Errors } from '../../utils/errors';
import { adminPaymentsService } from './admin-payments.service';
import { adminPaymentsQuerySchema } from './admin-payments.validation';

export const adminPaymentsController = {
  async list(req: Request, res: Response) {
    const parsed = adminPaymentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation(
        parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'query', message: i.message })),
      );
    }

    const { items, meta } = await adminPaymentsService.list(parsed.data);
    res.status(200).json({ success: true, data: items, meta });
  },

  async get(req: Request, res: Response) {
    const payment = await adminPaymentsService.getById(String(req.params.id));
    res.status(200).json({ success: true, data: payment });
  },
};
