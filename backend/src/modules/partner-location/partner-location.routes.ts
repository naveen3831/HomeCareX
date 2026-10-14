import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { rateLimit } from "../../middleware/rateLimit.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import {
  getLocation,
  stopSharing,
  updateLocation,
} from "./partner-location.controller";
import {
  locationBodySchema,
  locationParamsSchema,
} from "./partner-location.validation";

/** Mounted at /partner/jobs. Own jobs only. */
export const partnerLocationRoutes = Router();

const partnerOnly = [
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
];

// The app sends one fix every ~10 s (6/min); 20/min leaves headroom for retries and reconnects.
const updateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req) => `loc:${req.user?.id ?? req.ip}:${req.params.id}`,
});

// PATCH /api/v1/partner/jobs/:id/location  { lat, lng, accuracy?, heading? }   active jobs only
partnerLocationRoutes.patch(
  "/:id/location",
  ...partnerOnly,
  updateLimiter,
  validationMiddleware({
    params: locationParamsSchema,
    body: locationBodySchema,
  }),
  updateLocation,
);

// GET /api/v1/partner/jobs/:id/location   current sharing state (survives a page reload)
partnerLocationRoutes.get(
  "/:id/location",
  ...partnerOnly,
  validationMiddleware({ params: locationParamsSchema }),
  getLocation,
);

// DELETE /api/v1/partner/jobs/:id/location   stop sharing
partnerLocationRoutes.delete(
  "/:id/location",
  ...partnerOnly,
  validationMiddleware({ params: locationParamsSchema }),
  stopSharing,
);

export default partnerLocationRoutes;
