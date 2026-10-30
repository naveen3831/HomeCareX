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
 * All endpoints require an authenticated admin with audit:read permission.
 *
 * Middleware is applied per-route (not via router.use) so it does not
 * leak onto other routers that share the /admin mount prefix.
 */
export const auditRoutes = Router();

// GET /api/v1/admin/audit-logs
auditRoutes.get(
  '/audit-logs',
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
  asyncHandler((req, res) => auditController.getAuditLogs(req, res)),
);

export default auditRoutes;
