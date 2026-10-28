import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  PAYOUTS_APPROVE,
  PAYOUTS_EXPORT,
} from "./payouts.constants";
import { payoutsController } from "./payouts.controller";

import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin. */
export const payoutsRoutes = Router();

/**
 * All payout routes require authentication and admin access.
 */
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
/**
 * GET /api/v1/admin/payouts/export
 * Export payouts as CSV.
 * Keep this route before /payouts/:id to avoid treating "export" as an ID.
 */
payoutsRoutes.get(
  "/payouts/export",
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

/**
 * GET /api/v1/admin/payouts?page=1&limit=20&status=pending
 * List payout batches.
 */
payoutsRoutes.get(
  "/payouts",
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

/**
 * POST /api/v1/admin/payouts
 * Generate a payout batch.
 */
payoutsRoutes.post(
  "/payouts",
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/payouts
 * List payouts belonging to a batch.
 */
payoutsRoutes.get(
  "/payouts/:id/payouts",
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/export
 * Export a payout batch as CSV.
 */
payoutsRoutes.get(
  "/payouts/:id/export",
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id
 * Get payout batch details.
 */
payoutsRoutes.get(
  "/payouts/:id",
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

/**
 * PATCH /api/v1/admin/payouts/:id
 * Mark an individual payout as paid.
 */
payoutsRoutes.patch(
  "/payouts/:id",
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * PATCH /api/v1/admin/payouts/:id/mark-paid
 * Backward-compatible alias for marking a payout as paid.
 */
payoutsRoutes.patch(
  "/payouts/:id/mark-paid",
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * Compatibility aliases for older /payout-batches endpoints.
 */
payoutsRoutes.post(
  "/payout-batches",
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.get(
  "/payout-batches",
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.get(
  "/payout-batches/:id/payouts",
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

payoutsRoutes.get(
  "/payout-batches/:id/export",
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  "/payout-batches/:id",
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

export default payoutsRoutes;
