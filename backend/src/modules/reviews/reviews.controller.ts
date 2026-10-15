import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { ReviewsService } from './reviews.service';

export class ReviewsController {
  constructor(private readonly reviewsService = new ReviewsService()) {}

  createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await this.reviewsService.createReview(res.locals.auth.sub, req.body);
      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  };

  /** POST /bookings/:id/review */
  createBookingReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await this.reviewsService.createBookingReview(res.locals.auth.sub, req.params.id, req.body);
      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  };

  /** GET /reviews (the signed-in customer's own) */
  listMyReviews = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reviewsService.listMyReviews(res.locals.auth.sub) });
    } catch (error) {
      next(error);
    }
  };

  /** GET /reviews/pending */
  listPendingReviews = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reviewsService.listPendingReviews(res.locals.auth.sub) });
    } catch (error) {
      next(error);
    }
  };

  listCustomerReviews = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reviewsService.listCustomerReviews(res.locals.auth.sub) });
    } catch (error) {
      next(error);
    }
  };

  /** Public. data = { summary, reviews }, meta = { page, limit, total, totalPages }. */
  listServiceReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { summary, reviews, meta } = await this.reviewsService.listServiceReviews(req.params, req.query);
      sendSuccess(res, { summary, reviews }, { meta: { ...meta } });
    } catch (error) {
      next(error);
    }
  };

  listAdminReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reviewsService.listAdminReviews(req.query) });
    } catch (error) {
      next(error);
    }
  };

  updateReviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reviewsService.updateReviewStatus(req.params.id, req.body?.status) });
    } catch (error) {
      next(error);
    }
  };
}
