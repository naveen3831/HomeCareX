
import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { ReviewsService } from './reviews.service';

export class ReviewsController {
  constructor(private readonly reviewsService = new ReviewsService()) {}

  /** POST /reviews */
  createReview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const review = await this.reviewsService.createReview(
        res.locals.auth.sub,
        req.body,
      );

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /bookings/:id/review */
  createBookingReview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const review = await this.reviewsService.createBookingReview(
        res.locals.auth.sub,
        req.params.id,
        req.body,
      );

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /reviews — signed-in customer's reviews */
  listMyReviews = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const reviews = await this.reviewsService.listMyReviews(
        res.locals.auth.sub,
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /reviews/pending */
  listPendingReviews = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const reviews = await this.reviewsService.listPendingReviews(
        res.locals.auth.sub,
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /reviews/mine */
  listCustomerReviews = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const reviews = await this.reviewsService.listCustomerReviews(
        res.locals.auth.sub,
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /services/:id/reviews
   * Public endpoint.
   * Returns the summary, reviews, and pagination metadata.
   */
  listServiceReviews = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { summary, reviews, meta } =
        await this.reviewsService.listServiceReviews(
          req.params,
          req.query,
        );

      sendSuccess(
        res,
        { summary, reviews },
        { meta: { ...meta } },
      );
    } catch (error) {
      next(error);
    }
  };

  /** GET /admin/reviews */
  listAdminReviews = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const reviews = await this.reviewsService.listAdminReviews(
        req.query,
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /admin/reviews/:id/status */
  updateReviewStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const review = await this.reviewsService.updateReviewStatus(
        req.params.id,
        req.body?.status,
        {
          id: String(res.locals.auth.sub),
          ip: req.ip || 'unknown',
        },
      );

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /admin/reviews/:id/visibility
   * Body: { "visible": false } to hide
   *       { "visible": true } to restore
   */
  updateReviewVisibility = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const review = await this.reviewsService.updateReviewVisibility(
        req.params.id,
        req.body?.visible,
      );

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };
}
