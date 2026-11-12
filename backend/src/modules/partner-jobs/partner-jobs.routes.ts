import { Router } from "express";
import multer from "multer";
import { MAX_START_MEDIA, MAX_START_VIDEO_BYTES } from "./job-media-storage";

import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import { receiveStartMedia } from "./partner-jobs.proof";

import {
  acceptJobOffer,
  collectJobPayment,
  completePartnerJob,
  createJobExtraCharge,
  getPartnerJob,
  listJobExtraCharges,
  listJobRequests,
  listPartnerJobs,
  raiseJobSos,
  rateJobCustomer,
  rejectJobOffer,
  updateBookingStatus,
  updateJobChecklistItem,
  verifyJobStart,
} from "./partner-jobs.controller";

import {
  checklistBodySchema,
  checklistParamsSchema,
  collectPaymentBodySchema,
  completeBodySchema,
  extraChargeBodySchema,
  jobParamsSchema,
  rateCustomerBodySchema,
  rejectBodySchema,
  sosBodySchema,
  statusBodySchema,
  verifyStartBodySchema,
} from "./partner-jobs.validation";

/** Mounted at /partner/jobs */
export const partnerJobsRoutes = Router();

/** Start and complete may arrive as multipart with a photo. The photo is optional and is not stored. */
const optionalPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single("photo");

/** verify-start: up to 5 photos / videos (field "media"; the old single "photo" field still works). */
const startMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_START_VIDEO_BYTES, files: MAX_START_MEDIA },
}).fields([
  { name: "media", maxCount: MAX_START_MEDIA },
  { name: "photo", maxCount: 1 },
]);

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
  validationMiddleware({ params: jobParamsSchema, body: rejectBodySchema }),
  rejectJobOffer,
);

// POST /api/v1/partner/jobs/:id/sos   body: { coordinates?: { lat, lng } | null }
partnerJobsRoutes.post(
  "/:id/sos",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: sosBodySchema }),
  raiseJobSos,
);

// POST /api/v1/partner/jobs/:id/verify-start   body: { otp }  (+ optional multipart: photos[] up to 6, video x1)
partnerJobsRoutes.post(
  "/:id/verify-start",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  startMediaUpload,
  validationMiddleware({ params: jobParamsSchema, body: verifyStartBodySchema }),
  verifyJobStart,
);

// POST /api/v1/partner/jobs/:id/complete   body: { notes? }
partnerJobsRoutes.post(
  "/:id/complete",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  optionalPhoto,
  validationMiddleware({ params: jobParamsSchema, body: completeBodySchema }),
  completePartnerJob,
);

// POST /api/v1/partner/jobs/:id/collect-payment   body: { method: "cash" | "upi" }
// The app calls /payment/collect, so both paths are served.
partnerJobsRoutes.post(
  ["/:id/collect-payment", "/:id/payment/collect"],
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: collectPaymentBodySchema }),
  collectJobPayment,
);

// POST /api/v1/partner/jobs/:id/rate-customer   body: { rating: 1-5, comment? }
partnerJobsRoutes.post(
  "/:id/rate-customer",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: rateCustomerBodySchema }),
  rateJobCustomer,
);

// PATCH /api/v1/partner/jobs/:id/checklist/:itemId   body: { done: boolean }
partnerJobsRoutes.patch(
  "/:id/checklist/:itemId",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: checklistParamsSchema, body: checklistBodySchema }),
  updateJobChecklistItem,
);

// GET /api/v1/partner/jobs/:id/extra-charges
partnerJobsRoutes.get(
  "/:id/extra-charges",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:read"),
  validationMiddleware({ params: jobParamsSchema }),
  listJobExtraCharges,
);

// POST /api/v1/partner/jobs/:id/extra-charges   body: { title, amount, quantity?, reason? }
partnerJobsRoutes.post(
  "/:id/extra-charges",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:jobs:update"),
  validationMiddleware({ params: jobParamsSchema, body: extraChargeBodySchema }),
  createJobExtraCharge,
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