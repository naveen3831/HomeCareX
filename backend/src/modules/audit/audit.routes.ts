import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/** Mounted at /api/v1/admin. All endpoints require audit:read permission. */
export const auditRoutes = Router();

auditRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
);

auditRoutes.get(
  '/audit-logs',
  asyncHandler((req, res) => auditController.getAuditLogs(req, res)),
);

export default auditRoutes;
