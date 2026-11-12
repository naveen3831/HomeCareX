import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { pricingAdminService } from './pricing.admin.service';
import { pricingService } from './pricing.service';
import type { GetPricingQuery, PutPricingBody } from './pricing.validation';
import type { QuoteInput } from './pricing.types';

export const pricingController = {
  async quote(req: Request, res: Response) {
    // The user id lets the quote include coupon per-user limits and the referral first-booking discount.
    const quote = await pricingService.quote(req.body as QuoteInput, getAuthUser(req).id);
    res.json({ success: true, data: quote });
  },

  async listAdmin(req: Request, res: Response) {
    sendSuccess(res, await pricingAdminService.list(req.query as unknown as GetPricingQuery));
  },

  async saveAdmin(req: Request, res: Response) {
    const admin = getAuthUser(req);
    const result = await pricingAdminService.save(req.body as PutPricingBody, {
      id: admin.id,
      ip: req.ip ?? 'unknown',
    });
    sendSuccess(res, result);
  },

  async deleteAdmin(req: Request, res: Response) {
    const admin = getAuthUser(req);
    const result = await pricingAdminService.remove(String(req.params.id), {
      id: admin.id,
      ip: req.ip ?? 'unknown',
    });
    sendSuccess(res, result);
  },
};

export class PricingController {}