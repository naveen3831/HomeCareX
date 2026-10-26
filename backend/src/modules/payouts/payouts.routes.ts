import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYOUTS_APPROVE, PAYOUTS_EXPORT } from './payouts.constants';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin in rootRouter. */
export const payoutsRoutes = Router();

const admin = [authenticate, requireAdmin];

// Payout batches (both /payout-batches and /payouts for backwards compatibility)
payoutsRoutes.post(
  '/payout-batches',
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);
payoutsRoutes.post(
  '/payouts',
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  '/payout-batches',
  ...admin,
  asyncHandler((req, res) => payoutsController.list(req, res)),
);
payoutsRoutes.get(
  '/payouts',
  ...admin,
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id',
  ...admin,
  asyncHandler((req, res) => payoutsController.get(req, res)),
);
payoutsRoutes.get(
  '/payouts/:id',
  ...admin,
  asyncHandler((req, res) => payoutsController.get(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  ...admin,
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);
payoutsRoutes.get(
  '/payouts/:id/payouts',
  ...admin,
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/export',
  ...admin,
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);
payoutsRoutes.get(
  '/payouts/:id/export',
  ...admin,
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

// Individual payout actions
payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);
payoutsRoutes.patch(
  '/payouts/:id',
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

export default payoutsRoutes;
