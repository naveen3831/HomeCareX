import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { getPartnerReviewSummary, getPartnerReviews } from './partner-reviews.controller';
import { partnerReviewsQuerySchema, partnerReviewsSummaryQuerySchema } from './partner-reviews.validation';

export const partnerReviewsRoutes = Router();

// GET /api/v1/partner/reviews/summary  (role: partner, permission: partner:reviews:read)
// Declared before '/' only for readability; the two paths never overlap.
partnerReviewsRoutes.get(
  '/summary',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:reviews:read'),
  validate(partnerReviewsSummaryQuerySchema, 'query'),
  getPartnerReviewSummary,
);

// GET /api/v1/partner/reviews?page=&limit=
partnerReviewsRoutes.get(
  '/',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:reviews:read'),
  validate(partnerReviewsQuerySchema, 'query'),
  getPartnerReviews,
);

export default partnerReviewsRoutes;
