import { Router } from 'express';
import { z } from 'zod';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { referralsService } from './referrals.service';

export const referralsRoutes = Router();
referralsRoutes.use(authenticate, requireRole('customer'));
referralsRoutes.get(
  '/',
  validate(
    z
      .object({ page: z.coerce.number().int().min(1).max(10_000).default(1) })
      .strict(),
    'query',
  ),
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    sendSuccess(
      res,
      await referralsService.summary(
        getAuthUser(req).id,
        Number(req.query.page),
      ),
    );
  }),
);
