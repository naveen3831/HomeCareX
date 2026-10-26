
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  PAYOUTS_APPROVE,
  PAYOUTS_EXPORT,
} from './payouts.constants';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin in src/routes/index.ts. */
export const payoutsRoutes = Router();

/**
 * All payout routes require authentication and admin access.
 */
payoutsRoutes.use(authenticate, requireAdmin);

/**
 * GET /api/v1/admin/payouts?page=1&limit=20&status=pending
 * List payout batches.
 */
payoutsRoutes.get(
  '/payouts',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

/**
 * POST /api/v1/admin/payouts
 * Generate a payout batch.
 */
payoutsRoutes.post(
  '/payouts',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id
 * Get payout batch details.
 */
payoutsRoutes.get(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/payouts
 * List payouts belonging to a batch.
 */
payoutsRoutes.get(
  '/payouts/:id/payouts',
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/export
 * Export a payout batch as CSV.
 */
payoutsRoutes.get(
  '/payouts/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

/**
 * PATCH /api/v1/admin/payouts/:id
 * Mark an individual payout as paid.
 */
payoutsRoutes.patch(
  '/payouts/:id',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * PATCH /api/v1/admin/payouts/:id/mark-paid
 * Backward-compatible alias for marking a payout as paid.
 */
payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * /payout-batches aliases retained for compatibility.
 */
payoutsRoutes.post(
  '/payout-batches',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  '/payout-batches',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/payouts',
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

payoutsRoutes.get(
  '/payout-batches/:id/export',
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

export default payoutsRoutes;
