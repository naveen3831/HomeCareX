import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/**
 * Audit log routes.
 *
 * Mounted at /api/v1/admin.
 * All endpoints require an authenticated admin with
 * audit:read permission.
 */
export const auditRoutes = Router();

// Protect all audit routes with authentication, admin role,
// and the required audit-read permission.
auditRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
);

// GET /api/v1/admin/audit-logs
auditRoutes.get(
  '/audit-logs',
  asyncHandler((req, res) =>
    auditController.getAuditLogs(req, res),
  ),
);

export default auditRoutes;
