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
// View refund list with filters and summary counts.
refundsRoutes.get(
  '/refunds',
  asyncHandler((req, res) =>
    refundsController.list(req, res),
  ),
);

// GET /admin/refunds/:id
// Get single refund request details with full populated data.
refundsRoutes.get(
  '/refunds/:id',
  asyncHandler((req, res) =>
    refundsController.getById(req, res),
  ),
);

// POST /admin/refunds
// Creating a manual refund requires payments:refund.
refundsRoutes.post(
  '/refunds',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.create(req, res),
  ),
);

// POST /admin/refunds/:id/approve
// Approving a refund and triggering wallet credit requires payments:refund.
refundsRoutes.post(
  '/refunds/:id/approve',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.approve(req, res),
  ),
);

// POST /admin/refunds/:id/reject
// Rejecting a refund requires payments:refund.
refundsRoutes.post(
  '/refunds/:id/reject',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.reject(req, res),
  ),
);

// PATCH /admin/refunds/:id
// Backward compatibility for approve/reject actions.
refundsRoutes.patch(
  '/refunds/:id',
  requirePermission(PAYMENTS_REFUND),
  asyncHandler((req, res) =>
    refundsController.update(req, res),
  ),
);

export default refundsRoutes;
