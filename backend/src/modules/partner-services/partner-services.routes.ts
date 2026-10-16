import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import {
  getServiceArea,
  getServices,
  updateServiceArea,
  updateServices,
} from "./partner-services.controller";
import { serviceAreaBodySchema, servicesBodySchema } from "./partner-services.validation";

const read = [authenticate, requireRole("partner"), requirePermission("partner:profile:read")];
const write = [authenticate, requireRole("partner"), requirePermission("partner:profile:update")];

/** Mounted at /partner/services. A partner only ever reaches their own record (id comes from the token). */
export const partnerServicesRoutes = Router();
// GET /api/v1/partner/services  -> { approved[], selectedIds[] }
partnerServicesRoutes.get("/", ...read, getServices);
// PATCH /api/v1/partner/services  { serviceIds: string[] }  approved services only
partnerServicesRoutes.patch("/", ...write, validationMiddleware(servicesBodySchema), updateServices);

/** Mounted at /partner/service-area. */
export const partnerServiceAreaRoutes = Router();
// GET /api/v1/partner/service-area
partnerServiceAreaRoutes.get("/", ...read, getServiceArea);
// PATCH /api/v1/partner/service-area  { baseLocation, cities, areas?, radiusKm 1-50 }
partnerServiceAreaRoutes.patch("/", ...write, validationMiddleware(serviceAreaBodySchema), updateServiceArea);
