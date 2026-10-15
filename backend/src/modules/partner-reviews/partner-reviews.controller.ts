import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerReviewsService } from './partner-reviews.service';
import type { PartnerReviewsQuery } from './partner-reviews.validation';

const requestedPartnerId = (req: Request): string | undefined =>
  typeof req.query.partnerId === 'string' ? req.query.partnerId : undefined;

export const getPartnerReviews = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  // `validate` has already replaced req.query with the parsed value (page/limit are numbers with defaults).
  const { page, limit } = req.query as unknown as PartnerReviewsQuery;
  const { reviews, meta } = await partnerReviewsService.list(sub, page, limit, requestedPartnerId(req));
  sendSuccess(res, reviews, { meta: { ...meta } });
});

export const getPartnerReviewSummary = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerReviewsService.getSummary(sub, requestedPartnerId(req)));
});
