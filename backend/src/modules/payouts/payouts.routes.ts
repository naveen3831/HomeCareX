import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYOUTS_APPROVE, PAYOUTS_EXPORT } from './payouts.constants';
import { payoutsController } from './payouts.controller';

/** Mounted at /api/v1/admin. */
export const payoutsRoutes = Router();

/** All payout routes require authentication and admin access. */
payoutsRoutes.use(authenticate, requireAdmin);

// CSV export routes must be registered before parameter routes
// so that "export" is not treated as an :id.
payoutsRoutes.get(
  '/payouts/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payouts/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

// Payout batch listing and generation.
payoutsRoutes.get(
  '/payouts',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.post(
  '/payouts',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

// Individual payouts belonging to a batch.
payoutsRoutes.get(
  '/payouts/:id/payouts',
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

// Payout batch details.
payoutsRoutes.get(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

// Mark an individual payout as paid.
payoutsRoutes.patch(
  '/payouts/:id',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

// Compatibility aliases for older /payout-batches endpoints.
payoutsRoutes.get(
  '/payout-batches',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.post(
  '/payout-batches',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

export default payoutsRoutes;
