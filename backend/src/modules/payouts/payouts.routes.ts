
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { payoutsController } from './payouts.controller';

export const payoutsRoutes = Router();

payoutsRoutes.use(authenticate, requireAdmin);

// Keep the export route before /:id routes.
payoutsRoutes.get(
  '/payouts/export',
  asyncHandler((req, res) => payoutsController.exportCsv(req, res)),
);

payoutsRoutes.get(
  '/payouts',
  asyncHandler((req, res) => payoutsController.list(req, res)),
);

payoutsRoutes.post(
  '/payouts',
  asyncHandler((req, res) => payoutsController.generate(req, res)),
);

// The ID here is a payout-batch ID.
payoutsRoutes.get(
  '/payouts/:id/payouts',
  asyncHandler((req, res) => payoutsController.listBatchPayouts(req, res)),
);

payoutsRoutes.get(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.getBatch(req, res)),
);

// The ID here is an individual payout ID.
payoutsRoutes.patch(
  '/payouts/:id',
  asyncHandler((req, res) => payoutsController.markPaid(req, res)),
);

export default payoutsRoutes;