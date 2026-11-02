import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYOUTS_APPROVE, PAYOUTS_EXPORT } from './payouts.constants';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin. */
export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

// Keep export routes ahead of /:id so "export" is not read as a batch ID.
payoutsRoutes.get(
  '/payouts/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);
payoutsRoutes.get(
  '/payout-batches/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);
payoutsRoutes.get(
  '/payouts/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.list(req, res)),
);
payoutsRoutes.post(
  '/payouts',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);
payoutsRoutes.get(
  '/payout-batches',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.list(req, res)),
);
payoutsRoutes.post(
  '/payout-batches',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  '/payouts/:id/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.listBatchPayouts(req, res)),
);
payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);
payoutsRoutes.get(
  '/payouts/:id',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);
payoutsRoutes.get(
  '/payout-batches/:id',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.get(req, res)),
);

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

export default payoutsRoutes;
