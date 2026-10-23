import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { auditController } from "./audit.controller";

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUDIT_CONSTANTS } from './audit.constants';
import { auditController } from './audit.controller';

/** Mounted at /api/v1/admin. Admin only: audit logs hold actor, IP and before/after data. */
export const auditRoutes = Router();

auditRoutes.get(
  "/audit-logs",
  authenticate,
  requireAdmin,
  auditController.getAuditLogs.bind(auditController)
);
// All audit-log endpoints require an authenticated admin
// with the audit:read permission.
auditRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION)
);

// GET /api/v1/admin/audit-logs
auditRoutes.get(
  '/audit-logs',
  asyncHandler((req, res) => auditController.getAuditLogs(req, res))
);

export default auditRoutes;
