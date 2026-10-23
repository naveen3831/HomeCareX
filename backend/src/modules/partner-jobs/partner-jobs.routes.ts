import { Router } from "express";

import multer from "multer";

import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";

import {
  acceptJobOffer,
  completePartnerJob,
  createExtraCharge,
  getPartnerJob,
  listExtraCharges,
  listJobRequests,
  listPartnerJobs,
  rejectJobOffer,
  updateBookingStatus,
  updateChecklistItem,
  verifyStartJob,
} from "./partner-jobs.controller";

import {
  checklistItemBodySchema,
  checklistItemParamsSchema,
  completeJobBodySchema,
  extraChargeBodySchema,
  jobParamsSchema,
  statusBodySchema,
  verifyStartBodySchema,
} from "./partner-jobs.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Mounted at /partner/jobs */
export const partnerJobsRoutes = Router();

// GET /api/v1/partner/jobs
// Partner's live jobs
partnerJobsRoutes.get(
  "/",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  listPartnerJobs,
);

// GET /api/v1/partner/jobs/assigned
partnerJobsRoutes.get(
  "/assigned",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  listPartnerJobs,
);

// GET /api/v1/partner/jobs/requests
partnerJobsRoutes.get(
  "/requests",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  listJobRequests,
);

// GET /api/v1/partner/jobs/:id
// Partner can access their own jobs only
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
  "/:id/accept",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema }),
  acceptJobOffer,
);

// POST /api/v1/partner/jobs/:id/reject
partnerJobsRoutes.post(
  "/:id/reject",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema }),
  rejectJobOffer,
);

// POST /api/v1/partner/jobs/:id/verify-start
partnerJobsRoutes.post(
  "/:id/verify-start",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  upload.single("photo"),
  validationMiddleware({ params: jobParamsSchema, body: verifyStartBodySchema }),
  verifyStartJob,
);

// POST /api/v1/partner/jobs/:id/complete
partnerJobsRoutes.post(
  "/:id/complete",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  upload.single("photo"),
  validationMiddleware({ params: jobParamsSchema, body: completeJobBodySchema }),
  completePartnerJob,
);

// GET /api/v1/partner/jobs/:id/extra-charges
partnerJobsRoutes.get(
  "/:id/extra-charges",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  validationMiddleware({ params: jobParamsSchema }),
  listExtraCharges,
);

// POST /api/v1/partner/jobs/:id/extra-charges
partnerJobsRoutes.post(
  "/:id/extra-charges",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: extraChargeBodySchema }),
  createExtraCharge,
);

// PATCH /api/v1/partner/jobs/:id/checklist/:itemId
partnerJobsRoutes.patch(
  "/:id/checklist/:itemId",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({
    params: checklistItemParamsSchema,
    body: checklistItemBodySchema,
  }),
  updateChecklistItem,
);

/** Mounted at /partner/job-requests */
export const partnerJobRequestsRoutes = Router();

// GET /api/v1/partner/job-requests
partnerJobRequestsRoutes.get(
  "/",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  listJobRequests,
);

/** Mounted at /bookings */
export const bookingStatusRoutes = Router();

// PATCH /api/v1/bookings/:id/status
// Body: { status: "en_route" | "arrived", reason? }
bookingStatusRoutes.patch(
  "/:id/status",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({
    params: jobParamsSchema,
    body: statusBodySchema,
  }),
  updateBookingStatus,
);

export default partnerJobsRoutes;
