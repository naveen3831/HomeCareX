import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  PAYOUTS_APPROVE,
  PAYOUTS_EXPORT,
} from "./payouts.constants";
import { payoutsController } from "./payouts.controller";

/**
 * This router is mounted at /admin.
 */
export const payoutsRoutes = Router();

/**
 * All payout routes require authentication and admin access.
 */
payoutsRoutes.use(authenticate, requireAdmin);

/**
 * GET /api/v1/admin/payouts/export
 * Export payouts as CSV.
 *
 * Keep this route before /:id.
 */
payoutsRoutes.get(
  "/payouts/export",
  requirePermission(PAYOUTS_EXPORT),
  payoutsController.exportCsv,
);

/**
 * GET /api/v1/admin/payouts
 * List payout batches.
 */
payoutsRoutes.get(
  "/payouts",
  payoutsController.listBatches,
);

/**
 * POST /api/v1/admin/payouts
 * Generate a payout batch.
 */
payoutsRoutes.post(
  "/payouts",
  requirePermission(PAYOUTS_APPROVE),
  payoutsController.generateBatch,
);

/**
 * GET /api/v1/admin/payouts/:id/payouts
 * List payouts belonging to a batch.
 *
 * Keep this before /payouts/:id.
 */
payoutsRoutes.get(
  "/payouts/:id/payouts",
  payoutsController.listPayouts,
);

/**
 * GET /api/v1/admin/payouts/:id/export
 * Export one batch as CSV.
 */
payoutsRoutes.get(
  "/payouts/:id/export",
  requirePermission(PAYOUTS_EXPORT),
  payoutsController.exportCsv,
);

/**
 * PATCH /api/v1/admin/payouts/:id/mark-paid
 * Mark an individual payout as paid.
 *
 * Keep this before the generic PATCH /payouts/:id route.
 */
payoutsRoutes.patch(
  "/payouts/:id/mark-paid",
  requirePermission(PAYOUTS_APPROVE),
  payoutsController.markPaid,
);

/**
 * PATCH /api/v1/admin/payouts/:id/status
 * Update an individual payout status.
 */
payoutsRoutes.patch(
  "/payouts/:id/status",
  requirePermission(PAYOUTS_APPROVE),
  payoutsController.updateStatus,
);

/**
 * GET /api/v1/admin/payouts/:id
 * Get payout batch details.
 */
payoutsRoutes.get(
  "/payouts/:id",
  payoutsController.getBatch,
);

/**
 * PATCH /api/v1/admin/payouts/:id
 * Compatibility endpoint for marking an individual payout as paid.
 */
payoutsRoutes.patch(
  "/payouts/:id",
  requirePermission(PAYOUTS_APPROVE),
  payoutsController.markPaid,
);

/**
 * Compatibility aliases for older /payout-batches endpoints.
 */
payoutsRoutes.post(
  "/payout-batches",
  requirePermission(PAYOUTS_APPROVE),
  payoutsController.generateBatch,
);

payoutsRoutes.get(
  "/payout-batches",
  payoutsController.listBatches,
);

payoutsRoutes.get(
  "/payout-batches/:id/payouts",
  payoutsController.listPayouts,
);

payoutsRoutes.get(
  "/payout-batches/:id/export",
  requirePermission(PAYOUTS_EXPORT),
  payoutsController.exportCsv,
);

payoutsRoutes.get(
  "/payout-batches/:id",
  payoutsController.getBatch,
);

export default payoutsRoutes;