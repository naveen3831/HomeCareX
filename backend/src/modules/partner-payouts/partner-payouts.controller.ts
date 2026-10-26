import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerPayoutsService } from './partner-payouts.service';
import type { PayoutsQuery } from './partner-payouts.validation';

/** req.query / req.params were already parsed by validate(...). */
export const listPayouts = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerPayoutsService.list(sub, req.query as unknown as PayoutsQuery));
});

export const getPayout = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerPayoutsService.getById(sub, String(req.params.id)));
});