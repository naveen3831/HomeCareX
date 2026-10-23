
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  requireAdmin,
  requireRole,
} from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { ReviewsController } from './reviews.controller';

export const reviewsRoutes = Router();
const controller = new ReviewsController();

/**
 * The customer lists take no filters. A client-sent `customerId` is tolerated (old clients send it) but
 * IGNORED: the list is always scoped to the signed-in customer from the token. Anything else is a 400.
 */
const ownListQuery = validate(
  z.object({ customerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid customer id') }).partial().strict(),
  'query',
);

// Public: visible reviews and star distribution for a service.
reviewsRoutes.get(
  '/services/:id/reviews',
  controller.listServiceReviews,
);

// Customer: review their own completed booking.
reviewsRoutes.post(
  '/bookings/:id/review',
  authenticate,
  requireRole('customer'),
  controller.createBookingReview,
);

// Customer: their own reviews and pending reviews.
reviewsRoutes.get(
  '/reviews',
  authenticate,
  requireRole('customer'),
  ownListQuery,
  controller.listMyReviews,
);

reviewsRoutes.get(
  '/reviews/pending',
  authenticate,
  requireRole('customer'),
  ownListQuery,
  controller.listPendingReviews,
);

// Legacy site-wide testimonial flow.
reviewsRoutes.post(
  '/reviews',
  authenticate,
  requireRole('customer'),
  controller.createReview,
);

reviewsRoutes.get(
  '/reviews/mine',
  authenticate,
  requireRole('customer'),
  ownListQuery,
  controller.listCustomerReviews,
);

// Admin: list and filter reviews.
reviewsRoutes.get(
  '/admin/reviews',
  authenticate,
  requireAdmin,
  controller.listAdminReviews,
);

// Admin: change moderation status (pending, approved, rejected).
reviewsRoutes.patch(
  '/admin/reviews/:id/status',
  authenticate,
  requireAdmin,
  controller.updateReviewStatus,
);

// Admin: hide or restore a review.
// The permission middleware must recognize and grant reviews:moderate.
reviewsRoutes.patch(
  '/admin/reviews/:id/visibility',
  authenticate,
  requireAdmin,
  requirePermission('reviews:moderate'),
  controller.updateReviewVisibility,
);

export default reviewsRoutes;
