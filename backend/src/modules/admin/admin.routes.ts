import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

import { adminBookingsController } from './admin-bookings.controller';
import { authController } from '../auth/auth.controller';
import { rbacStaffController } from '../rbac/rbac.staff.controller';

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireAdmin);

// Staff invite. The rbac module owns GET/POST /admin/staff; until it lands this sends the invite email.
adminRoutes.post('/staff', authController.inviteStaff);
adminRoutes.get('/staff', asyncHandler((req, res) => rbacStaffController.list(req, res)));
adminRoutes.patch('/staff/:id', asyncHandler((req, res) => rbacStaffController.setStatus(req, res)));
adminRoutes.patch('/users/:id/role', asyncHandler((req, res) => rbacStaffController.changeRole(req, res)));

adminRoutes.get(
  '/bookings',
  asyncHandler((req, res) =>
    adminBookingsController.getBookings(req, res),
  ),
);

adminRoutes.get(
  '/bookings/:bookingId',
  asyncHandler((req, res) =>
    adminBookingsController.getBookingById(req, res),
  ),
);

adminRoutes.get(
  '/bookings/:bookingId/eligible-partners',
  asyncHandler((req, res) =>
    adminBookingsController.getEligiblePartners(req, res),
  ),
);

adminRoutes.patch(
  '/bookings/:bookingId/assign',
  asyncHandler((req, res) =>
    adminBookingsController.assignPartner(req, res),
  ),
);

adminRoutes.patch(
  '/bookings/:bookingId/status',
  asyncHandler((req, res) =>
    adminBookingsController.overrideStatus(req, res),
  ),
);

adminRoutes.post(
  '/bookings/:bookingId/cancel',
  asyncHandler((req, res) =>
    adminBookingsController.cancelBooking(req, res),
  ),
);