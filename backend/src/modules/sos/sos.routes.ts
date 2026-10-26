import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { rateLimit } from "../../middleware/rateLimit.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import { triggerSos } from "./sos.controller";
import { triggerSosSchema } from "./sos.validation";

/** Mounted at /partner/safety. */
export const sosRoutes = Router();

// Generous enough for panic re-presses and retries; the service also dedupes inside 60 s.
const sosLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => `sos:${req.user?.id ?? req.ip}`,
});

// POST /api/v1/partner/safety/sos  { bookingId?, location?, note? }
sosRoutes.post(
  "/sos",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:safety:sos"),
  sosLimiter,
  validationMiddleware(triggerSosSchema),
  triggerSos,
);

export default sosRoutes;
