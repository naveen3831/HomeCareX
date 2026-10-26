
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
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYOUTS_APPROVE, PAYOUTS_EXPORT } from './payouts.constants';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin. Middleware is per route so it never touches the other routers mounted on /admin. */
export const payoutsRoutes = Router();

const admin = [authenticate, requireAdmin];

payoutsRoutes.post('/payout-batches', ...admin, requirePermission(PAYOUTS_APPROVE), asyncHandler((req, res) => payoutsController.generate(req, res)));
payoutsRoutes.get('/payout-batches', ...admin, asyncHandler((req, res) => payoutsController.list(req, res)));
payoutsRoutes.get('/payout-batches/:id', ...admin, asyncHandler((req, res) => payoutsController.get(req, res)));
payoutsRoutes.get('/payout-batches/:id/payouts', ...admin, asyncHandler((req, res) => payoutsController.listPayouts(req, res)));
payoutsRoutes.get('/payout-batches/:id/export', ...admin, requirePermission(PAYOUTS_EXPORT), asyncHandler((req, res) => payoutsController.exportCsv(req, res)));
payoutsRoutes.patch('/payouts/:id/mark-paid', ...admin, requirePermission(PAYOUTS_APPROVE), asyncHandler((req, res) => payoutsController.markPaid(req, res)));

export default payoutsRoutes;
