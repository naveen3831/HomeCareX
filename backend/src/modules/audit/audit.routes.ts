import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { auditController } from "./audit.controller";

/** Mounted at /api/v1/admin. Admin only: audit logs hold actor, IP and before/after data. */
export const auditRoutes = Router();

auditRoutes.get(
  "/audit-logs",
  authenticate,
  requireAdmin,
  auditController.getAuditLogs.bind(auditController)
);