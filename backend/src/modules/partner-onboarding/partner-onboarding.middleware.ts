import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../../constants/errorCodes';
import { httpError } from '../../utils/errors';
import { partnerOnboardingService } from './partner-onboarding.service';

/**
 * Use after `authenticate` on partner work pages (dashboard, jobs, earnings ...).
 * A partner with approved KYC gets in only after finishing the training AND an admin approving it.
 * Other roles pass; the route's own role check still applies.
 */
export const requireTrainingApproved = (_req: Request, res: Response, next: NextFunction): void => {
  const auth = res.locals.auth as { sub?: string; role?: string } | undefined;
  if (!auth?.sub || auth.role !== 'partner') return next();
  partnerOnboardingService
    .isCleared(auth.sub)
    .then((ok) =>
      ok
        ? next()
        : next(httpError(403, ERROR_CODES.TRAINING_NOT_APPROVED, 'Finish the training and wait for admin approval to use the app')),
    )
    .catch(next);
};
