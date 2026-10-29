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
 */
export const auditRoutes = Router();

// NOTE: this router is mounted at the bare "/admin" path. A router-level use(requirePermission(...)) would run for
// EVERY /admin/* request that reaches it (bookings, partners, ...), so those pages failed with "Missing permission:
// audit:view". The guards are therefore attached to the audit-log route itself.

// GET /api/v1/admin/audit-logs
auditRoutes.get(
  '/audit-logs',
  authenticate,
  requireAdmin,
  requirePermission(AUDIT_CONSTANTS.PERMISSION),
  asyncHandler((req, res) => auditController.getAuditLogs(req, res)),
);

export default auditRoutes;