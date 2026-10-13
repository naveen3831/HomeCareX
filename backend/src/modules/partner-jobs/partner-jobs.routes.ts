import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import {
  getPartnerJob,
  listPartnerJobs,
  updateBookingStatus,
} from "./partner-jobs.controller";
import { jobParamsSchema, statusBodySchema } from "./partner-jobs.validation";

/** Mounted at /partner/jobs */
export const partnerJobsRoutes = Router();

// GET /api/v1/partner/jobs  (role: partner, permission: partner:jobs:read): the partner's live jobs
partnerJobsRoutes.get(
  "/",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  listPartnerJobs,
);

// GET /api/v1/partner/jobs/:id  (role: partner, permission: partner:jobs:read, own jobs only)
partnerJobsRoutes.get(
  "/:id",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  validationMiddleware({ params: jobParamsSchema }),
  getPartnerJob,
);

// POST /api/v1/partner/jobs/:id/accept
partnerJobsRoutes.post(
  '/:id/accept',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:jobs:update'),
  validationMiddleware({ params: jobParamsSchema }),
  acceptJobOffer,
);

// POST /api/v1/partner/jobs/:id/reject
partnerJobsRoutes.post(
  '/:id/reject',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:jobs:update'),
  validationMiddleware({ params: jobParamsSchema }),
  rejectJobOffer,
);

/** Mounted at /partner/job-requests */
export const partnerJobRequestsRoutes = Router();

// GET /api/v1/partner/job-requests
partnerJobRequestsRoutes.get(
  '/',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:jobs:read'),
  listJobRequests,
);

/** Mounted at /bookings */
export const bookingStatusRoutes = Router();

// PATCH /api/v1/bookings/:id/status  { status: 'en_route' | 'arrived', reason? }
bookingStatusRoutes.patch(
  "/:id/status",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: statusBodySchema }),
  updateBookingStatus,
);

export default partnerJobsRoutes;
