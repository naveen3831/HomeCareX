
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin. */
export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

// CSV export routes must be registered before parameter routes.
payoutsRoutes.get(
  '/payouts/export',
  requirePermission('payouts:export'),
  asyncHandler((req, res) =>
    payoutsController.exportCsv(req, res),
  ),
);

payoutsRoutes.get(
  '/payout-batches/:id/export',
  requirePermission('payouts:export'),
  asyncHandler((req, res) =>
    payoutsController.exportCsv(req, res),
  ),
);

payoutsRoutes.get(
  '/payouts/:id/export',
  requirePermission('payouts:export'),
  asyncHandler((req, res) =>
    payoutsController.exportCsv(req, res),
  ),
);

// Payout batch listing and generation.
payoutsRoutes.get(
  '/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.list(req, res),
  ),
);

payoutsRoutes.post(
  '/payouts',
  requirePermission('payouts:approve'),
  asyncHandler((req, res) =>
    payoutsController.generate(req, res),
  ),
);

payoutsRoutes.get(
  '/payout-batches',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.list(req, res),
  ),
);

payoutsRoutes.post(
  '/payout-batches',
  requirePermission('payouts:approve'),
  asyncHandler((req, res) =>
    payoutsController.generate(req, res),
  ),
);

// Payout batch details.
payoutsRoutes.get(
  '/payouts/:id',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.getBatch(req, res),
  ),
);

payoutsRoutes.get(
  '/payout-batches/:id',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.get(req, res),
  ),
);

// Individual payouts belonging to a batch.
payoutsRoutes.get(
  '/payouts/:id/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.listBatchPayouts(req, res),
  ),
);

payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) =>
    payoutsController.listPayouts(req, res),
  ),
);

// Mark a payout as paid.
// Both endpoints use the service's existing markPaid implementation.
payoutsRoutes.patch(
  '/payouts/:id',
  requirePermission('payouts:approve'),
  asyncHandler((req, res) =>
    payoutsController.markPaid(req, res),
  ),
);

payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  requirePermission('payouts:approve'),
  asyncHandler((req, res) =>
    payoutsController.markPaid(req, res),
  ),
);

export default payoutsRoutes;
