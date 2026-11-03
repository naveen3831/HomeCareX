import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { Errors } from '../../utils/errors';
import { ONBOARDING_TOTAL_STEPS, partnerOnboardingService } from './partner-onboarding.service';

export const partnerOnboardingRoutes = Router();

const userIdOf = (res: Response): string => (res.locals.auth as { sub: string }).sub;
const guard = [authenticate, requireRole('partner')];

// GET /api/v1/partner/onboarding
partnerOnboardingRoutes.get(
  '/',
  ...guard,
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await partnerOnboardingService.get(userIdOf(res)));
  }),
);

// POST /api/v1/partner/onboarding/steps/:step/complete
partnerOnboardingRoutes.post(
  '/steps/:step/complete',
  ...guard,
  asyncHandler(async (req: Request, res: Response) => {
    const step = Number(req.params.step);
    if (!Number.isInteger(step) || step < 1 || step > ONBOARDING_TOTAL_STEPS) {
      throw Errors.badRequest(`Step must be a number from 1 to ${ONBOARDING_TOTAL_STEPS}`);
    }
    sendSuccess(res, await partnerOnboardingService.completeStep(userIdOf(res), step));
  }),
);

export default partnerOnboardingRoutes;
