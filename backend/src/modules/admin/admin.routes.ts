import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

import { adminBookingsController } from './admin-bookings.controller';
import { authController } from '../auth/auth.controller';
import { rbacStaffController } from '../rbac/rbac.staff.controller';
import { requirePermission, requireResourceAccess } from '../../middleware/permission.middleware';
import { rbacRolesRoutes } from '../rbac/rbac.roles.routes';
import { rbacRolesService } from '../rbac/rbac.roles.service';

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireAdmin);

// RBAC: GET /admin/permissions, GET/POST/PATCH/DELETE /admin/roles
adminRoutes.use(rbacRolesRoutes);

// Staff: GET/POST /admin/staff, PATCH /admin/staff/:id, PATCH /admin/users/:id/role
adminRoutes.post(
  '/staff',
  requirePermission('staff:create'),
  asyncHandler(async (req, res, next) => {
    await rbacRolesService.assertExists(req.body?.roleId);
    return authController.inviteStaff(req, res, next);
  }),
);
adminRoutes.get('/staff', requirePermission('staff:view'), asyncHandler((req, res) => rbacStaffController.list(req, res)));
adminRoutes.patch('/staff/:id', requirePermission('staff:update'), asyncHandler((req, res) => rbacStaffController.setStatus(req, res)));
adminRoutes.patch('/users/:id/role', requirePermission('staff:update'), asyncHandler((req, res) => rbacStaffController.changeRole(req, res)));

// Bookings live in this router: guard them like the other modules.
adminRoutes.use('/bookings', requireResourceAccess('bookings'));

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