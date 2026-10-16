import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYMENTS_REFUND } from '../admin-payments/admin-payments.constants';
import { refundsController } from './refunds.controller';

export const refundsRoutes = Router();

refundsRoutes.use(authenticate, requireAdmin);

refundsRoutes.get(
  '/refunds',
  asyncHandler((req, res) =>
    refundsController.list(req, res),
  ),
);

// Money moves here, so both write routes need the finance permission on top of the admin role.
refundsRoutes.post(
  '/refunds',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.create(req, res),
  ),
);

refundsRoutes.patch(
  '/refunds/:id',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.update(req, res),
  ),
);

export default refundsRoutes;