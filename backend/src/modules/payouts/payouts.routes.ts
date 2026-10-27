
import { Router } from 'express';
<<<<<<< HEAD

=======
>>>>>>> origin/develop
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

<<<<<<< HEAD
=======
/** Mounted at /admin. */
>>>>>>> origin/develop
export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

<<<<<<< HEAD
// Export payouts as CSV.
// Keep this route before routes containing /:id.
payoutsRoutes.get(
  '/payouts/export',
  asyncHandler((req, res) =>
    payoutsController.exportCsv(req, res),
  ),
);

// List payout batches.
payoutsRoutes.get(
  '/payouts',
  asyncHandler((req, res) =>
    payoutsController.list(req, res),
  ),
);

// Generate a payout batch.
payoutsRoutes.post(
  '/payouts',
  asyncHandler((req, res) =>
    payoutsController.generate(req, res),
  ),
);

// List individual payouts belonging to a batch.
payoutsRoutes.get(
  '/payouts/:id/payouts',
  asyncHandler((req, res) =>
    payoutsController.listBatchPayouts(req, res),
  ),
);

// Get payout batch details.
payoutsRoutes.get(
  '/payouts/:id',
  asyncHandler((req, res) =>
    payoutsController.getBatch(req, res),
  ),
);

// Update an individual payout's status.
payoutsRoutes.patch(
  '/payouts/:id',
  asyncHandler((req, res) =>
    payoutsController.updateStatus(req, res),
  ),
);
=======
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
>>>>>>> origin/develop

export default payoutsRoutes;
