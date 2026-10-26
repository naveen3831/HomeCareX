
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

export const payoutsRoutes = Router();

/**
 * All payout routes require authentication and admin access.
 * The router is mounted at /admin in src/routes/index.ts.
 */
const admin = [authenticate, requireAdmin];

/**
 * GET /api/v1/admin/payouts?page=1&limit=20&status=pending
 * List payout batches.
 */
payoutsRoutes.get(
  "/payouts",
  ...admin,
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

/**
 * POST /api/v1/admin/payouts
 * Generate a payout batch.
 */
payoutsRoutes.post(
  "/payouts",
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id
 * Get payout batch details.
 */
payoutsRoutes.get(
  "/payouts/:id",
  ...admin,
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/payouts
 * List payouts belonging to a batch.
 */
payoutsRoutes.get(
  "/payouts/:id/payouts",
  ...admin,
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

/**
 * GET /api/v1/admin/payouts/:id/export
 * Export a payout batch as CSV.
 */
payoutsRoutes.get(
  "/payouts/:id/export",
  ...admin,
  requirePermission(PAYOUTS_EXPORT),
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

/**
 * PATCH /api/v1/admin/payouts/:id
 * Mark an individual payout as paid.
 */
payoutsRoutes.patch(
  "/payouts/:id",
  ...admin,
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

export default payoutsRoutes;
