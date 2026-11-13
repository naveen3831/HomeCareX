import type { Request, Response } from 'express';
import { Errors } from '../../utils/errors';
import { z } from 'zod';
import { adminPaymentsService } from './admin-payments.service';
import { adminReferralPaymentsService } from './admin-referral-payments.service';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './admin-payments.constants';
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

  /** GET /admin/payments/referrals: referral wallet credits (who got what) + referral discounts used on bookings. */
  async referrals(req: Request, res: Response) {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
        type: z.enum(['CUSTOMER', 'PARTNER']).optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      throw Errors.validation(
        parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'query', message: i.message })),
      );
    }
    res.status(200).json({ success: true, data: await adminReferralPaymentsService.overview(parsed.data) });
  },

  async get(req: Request, res: Response) {
    const payment = await adminPaymentsService.getById(String(req.params.id));
    res.status(200).json({ success: true, data: payment });
  },
};
