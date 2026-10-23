
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

export const payoutsRoutes = Router();

// All payout endpoints require authentication and admin access.
payoutsRoutes.use(authenticate, requireAdmin);

// GET /admin/payouts?page=1&limit=20&status=pending
payoutsRoutes.get(
  '/payouts',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

// POST /admin/payouts
payoutsRoutes.post(
  '/payouts',
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

// GET /admin/payouts/:id — payout batch details
payoutsRoutes.get(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

// GET /admin/payouts/:id/payouts — payouts belonging to a batch
payoutsRoutes.get(
  '/payouts/:id/payouts',
  asyncHandler((req, res) => payoutsController.listPayouts(req, res)),
);

// GET /admin/payouts/:id/export — export a batch as CSV
payoutsRoutes.get(
  '/payouts/:id/export',
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

// PATCH /admin/payouts/:id — mark an individual payout as paid
payoutsRoutes.patch(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

export default payoutsRoutes;
