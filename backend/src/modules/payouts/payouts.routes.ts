import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  PAYOUTS_APPROVE,
  PAYOUTS_EXPORT,
  PAYOUTS_VIEW,
} from './payouts.constants';
import { payoutsController } from './payouts.controller';

/**
 * Payout routes. Mounted at /api/v1/admin.
 *
 * Auth is applied per-route (not via router.use) so it does not leak onto
 * other routers that share the /admin mount prefix.
 */
export const payoutsRoutes = Router();

const adminOnly = [authenticate, requireAdmin];
const canView = [...adminOnly, requirePermission(PAYOUTS_VIEW)];
const canApprove = [...adminOnly, requirePermission(PAYOUTS_APPROVE)];
const canExport = [...adminOnly, requirePermission(PAYOUTS_EXPORT)];

// --- CSV export (must be registered before '/payouts/:id') ---
payoutsRoutes.get(
  '/payouts/export',
  ...canExport,
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payouts/:id/export',
  ...canExport,
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/export',
  ...canExport,
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

// --- List / generate batches ---
payoutsRoutes.get(
  '/payouts',
  ...canView,
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.post(
  '/payouts',
  ...canApprove,
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  '/payout-batches',
  ...canView,
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.post(
  '/payout-batches',
  ...canApprove,
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

// --- Individual payouts belonging to a batch ---
payoutsRoutes.get(
  '/payouts/:id/payouts',
  ...canView,
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  ...canView,
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

// --- Batch details ---
payoutsRoutes.get(
  '/payouts/:id',
  ...canView,
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id',
  ...canView,
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

// --- Mark an individual payout as paid ---
payoutsRoutes.patch(
  '/payouts/:id',
  ...canApprove,
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  ...canApprove,
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

export default payoutsRoutes;
