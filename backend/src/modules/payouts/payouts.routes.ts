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

const payoutsRoutes = Router();

/**
 * This router is mounted at /admin.
 *
 * All payout routes require authentication and admin access.
 */
payoutsRoutes.use(authenticate, requireAdmin);

/**
 * CSV export routes.
 *
 * Register specific export routes before generic parameter routes
 * to prevent route parameters from capturing "export".
 */
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

/**
 * Generate a payout batch from settled earnings.
 * Duplicate protection: earnings already in a batch answer 409.
 */
payoutsRoutes.post(
  '/payouts',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

payoutsRoutes.post(
  '/payout-batches',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

/**
 * List payout batches.
 */
payoutsRoutes.get(
  '/payouts',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

/**
 * Compatibility aliases for older payout-batch endpoints.
 */
payoutsRoutes.get(
  '/payout-batches/summary',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.summary(req, res)),
);

payoutsRoutes.get(
  '/payout-batches',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

/**
 * List payouts belonging to a batch.
 *
 * Register these before the generic batch-detail routes.
 */
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

/**
 * Admin (platform) wallet totals. Registered before /payouts/:id.
 */
payoutsRoutes.get(
  '/payout-wallet',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.adminWallet(req, res)),
);

/**
 * Admin wallet history (commission + partner payout lines), paginated.
 */
payoutsRoutes.get(
  '/payout-wallet/transactions',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.adminWalletTransactions(req, res)),
);

/**
 * Credit / debit report per day or week (admin received vs partner wallets). Read-only.
 * Both routes are registered before /payouts/:id and the generic batch routes.
 */
payoutsRoutes.get(
  '/payout-wallet/ledger',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.adminLedger(req, res)),
);

payoutsRoutes.get(
  '/payout-wallet/ledger/lines',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.adminLedgerLines(req, res)),
);

/**
 * Payout detail with the partner's services grouped by day.
 */
payoutsRoutes.get(
  '/payout-items/:id/details',
  requirePermission('payouts:view'),
  asyncHandler((req, res) => payoutsController.details(req, res)),
);

/**
 * Confirm payment for a whole batch (weekly "pay everyone").
 */
payoutsRoutes.post(
  '/payouts/:id/confirm',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.confirmBatch(req, res)),
);

payoutsRoutes.post(
  '/payout-batches/:id/confirm',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.confirmBatch(req, res)),
);

/**
 * Mark an individual payout as paid.
 *
 * The mark-paid route must be registered before PATCH /payouts/:id.
 */
payoutsRoutes.patch(
  '/payouts/:id/mark-paid',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * Compatibility endpoint for marking an individual payout as paid.
 */
payoutsRoutes.patch(
  '/payouts/:id',
  requirePermission(PAYOUTS_APPROVE),
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

/**
 * Retrieve payout batch details.
 */
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

export { payoutsRoutes };
export default payoutsRoutes;