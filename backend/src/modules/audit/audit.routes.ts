import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/** Mounted at /api/v1/admin. Audit logs are restricted to authorized administrators. */
export const auditRoutes = Router();

// All audit-log endpoints require an authenticated admin
// with the audit:read permission.
auditRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
);

// GET /api/v1/admin/audit-logs
auditRoutes.get(
  '/audit-logs',
  asyncHandler((req, res) => auditController.getAuditLogs(req, res)),
);

export default auditRoutes;
