
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportsController } from './reports.controller';
import { REPORTS_CONSTANTS } from './reports.constants';

export const reportsRoutes = Router();

// Protect all report endpoints.
reportsRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(REPORTS_CONSTANTS.PERMISSION),
);

// Bookings report.
reportsRoutes.get(
  '/bookings',
  asyncHandler((req, res) => reportsController.bookings(req, res)),
);

// Revenue report.
reportsRoutes.get(
  '/revenue',
  asyncHandler((req, res) => reportsController.revenue(req, res)),
);

// Partner performance report.
reportsRoutes.get(
  '/partners',
  asyncHandler((req, res) => reportsController.partners(req, res)),
);

// Bookings CSV export.
reportsRoutes.get(
  '/bookings/export',
  asyncHandler((req, res) => reportsController.exportBookings(req, res)),
);

// Revenue CSV export.
reportsRoutes.get(
  '/revenue/export',
  asyncHandler((req, res) => reportsController.exportRevenue(req, res)),
);

// Partner performance CSV export.
reportsRoutes.get(
  '/partners/export',
  asyncHandler((req, res) => reportsController.exportPartners(req, res)),
);

export default reportsRoutes;
