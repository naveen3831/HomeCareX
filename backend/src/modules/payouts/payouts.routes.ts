import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

/** Mounted at /admin. */
export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

// Standard /payout-batches endpoints
payoutsRoutes.post('/payout-batches', asyncHandler((req, res) => payoutsController.generate(req, res)));
payoutsRoutes.get('/payout-batches', asyncHandler((req, res) => payoutsController.list(req, res)));
payoutsRoutes.get('/payout-batches/:id', asyncHandler((req, res) => payoutsController.get(req, res)));
payoutsRoutes.get('/payout-batches/:id/payouts', asyncHandler((req, res) => payoutsController.listPayouts(req, res)));
payoutsRoutes.get('/payout-batches/:id/export', asyncHandler((req, res) => payoutsController.exportCsv(req, res)));

// /payouts endpoints alias
payoutsRoutes.get('/payouts', asyncHandler((req, res) => payoutsController.list(req, res)));
payoutsRoutes.post('/payouts', asyncHandler((req, res) => payoutsController.generate(req, res)));
payoutsRoutes.get('/payouts/:id', asyncHandler((req, res) => payoutsController.getBatch(req, res)));
payoutsRoutes.get('/payouts/:id/payouts', asyncHandler((req, res) => payoutsController.listPayouts(req, res)));
payoutsRoutes.get('/payouts/:id/export', asyncHandler((req, res) => payoutsController.exportCsv(req, res)));
payoutsRoutes.patch('/payouts/:id', asyncHandler((req, res) => payoutsController.markPaid(req, res)));
payoutsRoutes.patch('/payouts/:id/mark-paid', asyncHandler((req, res) => payoutsController.markPaid(req, res)));

export default payoutsRoutes;
