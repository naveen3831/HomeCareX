import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { rateLimit } from "../../middleware/rateLimit.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import { startMaskedCall } from "./masked-call.controller";
import { callParamsSchema } from "./masked-call.validation";

/** Mounted at /partner/jobs */
export const maskedCallRoutes = Router();

// POST /api/v1/partner/jobs/:id/call  -> { proxyNumber, expiresAt }   (10 per minute per partner)
maskedCallRoutes.post(
  "/:id/call",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  rateLimit({
    windowMs: 60_000,
    max: 10,
    keyGenerator: (req) => `call:${req.user?.id ?? req.ip}`,
  }),
  validationMiddleware({ params: callParamsSchema }),
  startMaskedCall,
);

export default maskedCallRoutes;
