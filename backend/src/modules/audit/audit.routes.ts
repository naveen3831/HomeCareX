import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/** Mounted at /api/v1/admin. Audit logs are restricted to authorized administrators. */
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
