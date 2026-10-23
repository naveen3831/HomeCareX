
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYMENTS_REFUND } from '../admin-payments/admin-payments.constants';
import { refundsController } from './refunds.controller';

export const refundsRoutes = Router();

// All refund endpoints require authentication and admin access.
refundsRoutes.use(authenticate, requireAdmin);

// GET /admin/refunds
// Keep the existing admin access rules for viewing refunds.
refundsRoutes.get(
  '/refunds',
  asyncHandler((req, res) =>
    refundsController.list(req, res),
  ),
);

// POST /admin/refunds
// Creating a refund or wallet credit requires payments:refund.
refundsRoutes.post(
  '/refunds',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.create(req, res),
  ),
);

// PATCH /admin/refunds/:id
// Approving or rejecting a refund requires payments:refund.
refundsRoutes.patch(
  '/refunds/:id',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.update(req, res),
  ),
);

export default refundsRoutes;
