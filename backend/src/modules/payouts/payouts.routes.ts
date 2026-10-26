
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

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

export default payoutsRoutes;
