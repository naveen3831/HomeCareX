import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { PAYMENTS_READ } from './admin-payments.constants';
import { adminPaymentsController } from './admin-payments.controller';

/** Mounted at /admin/payments. Read-only: there is intentionally no POST/PATCH/DELETE here. */
export const adminPaymentsRoutes = Router();

adminPaymentsRoutes.use(authenticate, requireAdmin, requirePermission(PAYMENTS_READ));

// GET /api/v1/admin/payments?status=&method=&from=&to=&customer=&booking=&search=&page=&limit=
adminPaymentsRoutes.get('/', asyncHandler((req, res) => adminPaymentsController.list(req, res)));

// GET /api/v1/admin/payments/:id  (detail page; still read-only)
adminPaymentsRoutes.get('/:id', asyncHandler((req, res) => adminPaymentsController.get(req, res)));

export default adminPaymentsRoutes;