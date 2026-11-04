import { Router, type Request } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerOnboardingService } from '../partner-onboarding/partner-onboarding.service';

/**
 * Mounted at /api/v1/admin/partners/:id/training (admin only; the parent router already
 * runs authenticate + requireAdmin). `:id` is the same login user id the partner details page uses.
 */
export const partnerTrainingAdminRoutes = Router({ mergeParams: true });

const actorOf = (req: Request) => ({ id: getAuthUser(req).id, ip: req.ip || 'unknown' });
const idOf = (req: Request): string => String(req.params.id);

// GET  /admin/partners/:id/training
partnerTrainingAdminRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await partnerOnboardingService.adminGet(idOf(req)));
  }),
);

// POST /admin/partners/:id/training/approve  : let a partner who finished the demo into the app
partnerTrainingAdminRoutes.post(
  '/approve',
  requirePermission('kyc:approve'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await partnerOnboardingService.adminApprove(idOf(req), actorOf(req)), { message: 'Training approved. The partner can now use the app.' });
  }),
);

// POST /admin/partners/:id/training/reset    : send the partner back to step 1 and remove access
partnerTrainingAdminRoutes.post(
  '/reset',
  requirePermission('kyc:approve'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await partnerOnboardingService.adminReset(idOf(req), actorOf(req)), { message: 'Training reset. The partner must complete it again.' });
  }),
);

export default partnerTrainingAdminRoutes;
