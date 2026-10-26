import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/** Mounted at /api/v1/admin. Admin only: audit logs hold actor, IP and before/after data. */
export const auditRoutes = Router();

// GET /api/v1/admin/audit-logs (needs the audit permission)
auditRoutes.get(
  '/audit-logs',
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
  asyncHandler((req, res) => auditController.getAuditLogs(req, res)),
);

export default auditRoutes;
