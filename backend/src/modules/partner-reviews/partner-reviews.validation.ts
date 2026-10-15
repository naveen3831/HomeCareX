import { z } from 'zod';
import { REVIEW_LIMIT_DEFAULT, REVIEW_LIMIT_MAX, REVIEW_PAGE_DEFAULT, REVIEW_PAGE_MAX } from '../reviews/reviews.constants';

/** "?page=" (empty) counts as "not sent" so a cleared control never errors. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * `partnerId` is accepted only so that someone else's id is refused with 403 instead of being silently ignored.
 * The partner is always taken from the verified JWT. Any other query field is a 400.
 */
const partnerIdField = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid partner id').optional();

export const partnerReviewsQuerySchema = z
  .object({
    page: z.preprocess(
      blankToUndefined,
      z.coerce
        .number()
        .int('page must be a whole number')
        .min(1, 'page must be at least 1')
        .max(REVIEW_PAGE_MAX, `page must be at most ${REVIEW_PAGE_MAX}`)
        .default(REVIEW_PAGE_DEFAULT),
    ),
    limit: z.preprocess(
      blankToUndefined,
      z.coerce
        .number()
        .int('limit must be a whole number')
        .min(1, 'limit must be at least 1')
        .max(REVIEW_LIMIT_MAX, `limit must be at most ${REVIEW_LIMIT_MAX}`)
        .default(REVIEW_LIMIT_DEFAULT),
    ),
    partnerId: partnerIdField,
  })
  .strict();

export const partnerReviewsSummaryQuerySchema = z.object({ partnerId: partnerIdField }).strict();

export type PartnerReviewsQuery = z.infer<typeof partnerReviewsQuerySchema>;
