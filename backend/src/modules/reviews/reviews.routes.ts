import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin, requireRole } from '../../middleware/role.middleware';
import { ReviewsController } from './reviews.controller';

export const reviewsRoutes = Router();
const controller = new ReviewsController();

// Public, no auth: visible reviews + star distribution for the service details page.
reviewsRoutes.get('/services/:id/reviews', controller.listServiceReviews);
// Customer: review a completed booking (own booking only, one review per booking).
reviewsRoutes.post('/bookings/:id/review', authenticate, requireRole('customer'), controller.createBookingReview);
// Customer: my reviews, and the completed bookings still waiting for one.
reviewsRoutes.get('/reviews', authenticate, requireRole('customer'), controller.listMyReviews);
reviewsRoutes.get('/reviews/pending', authenticate, requireRole('customer'), controller.listPendingReviews);
// Legacy site-wide testimonial form (no booking required). Kept for the existing testimonials flow.
reviewsRoutes.post('/reviews', authenticate, requireRole('customer'), controller.createReview);
reviewsRoutes.get('/reviews/mine', authenticate, requireRole('customer'), controller.listCustomerReviews);
reviewsRoutes.get('/admin/reviews', authenticate, requireAdmin, controller.listAdminReviews);
reviewsRoutes.patch('/admin/reviews/:id/status', authenticate, requireAdmin, controller.updateReviewStatus);

export default reviewsRoutes;
