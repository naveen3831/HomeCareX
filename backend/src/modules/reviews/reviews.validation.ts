import { Types } from 'mongoose';
import { z } from 'zod';
import { REVIEW_COMMENT_MAX, REVIEW_LIMIT_DEFAULT, REVIEW_LIMIT_MAX, REVIEW_PAGE_DEFAULT, REVIEW_PAGE_MAX, REVIEW_TAGS } from './reviews.constants';

/** "?page=" (empty) is treated as "not sent" so a cleared control never errors. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const objectId = (label: string) =>
  z.string({ required_error: `${label} is required` }).trim().refine((v) => /^[0-9a-fA-F]{24}$/.test(v) && Types.ObjectId.isValid(v), `${label} must be a valid id`);

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(20, 'Review must be at least 20 characters').max(2000, 'Review must be 2000 characters or fewer'),
  /** Optional link to a service. `verified` is never accepted from the client: the server derives it from the booking. */
  serviceId: objectId('serviceId').optional(),
  bookingId: objectId('bookingId').optional(),
}).refine((v) => !v.bookingId || Boolean(v.serviceId), { path: ['serviceId'], message: 'serviceId is required when bookingId is given' });

/** POST /bookings/:id/review. Only the rating is required; ids come from the booking, never from the body. */
export const createBookingReviewSchema = z.object({
  rating: z
    .number({ required_error: 'rating is required', invalid_type_error: 'rating must be a number from 1 to 5' })
    .int('rating must be a whole number from 1 to 5')
    .min(1, 'rating must be at least 1')
    .max(5, 'rating must be at most 5'),
  comment: z
    .string({ invalid_type_error: 'comment must be text' })
    .trim()
    .max(REVIEW_COMMENT_MAX, `comment must be ${REVIEW_COMMENT_MAX} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined)),
  tags: z
    .array(z.enum(REVIEW_TAGS, { errorMap: () => ({ message: `tags must be from: ${REVIEW_TAGS.join(', ')}` }) }))
    .max(REVIEW_TAGS.length, 'too many tags')
    .optional()
    .transform((v) => Array.from(new Set(v ?? []))),
});

export const bookingIdParamSchema = z.object({ id: objectId('Booking id') });

export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: reviewStatusSchema.optional(),
});

export const serviceReviewsParamSchema = z.object({ id: objectId('Service id') });

/** Public list query. `.strict()` makes any stray param a 400. */
export const serviceReviewsQuerySchema = z
  .object({
    page: z.preprocess(blankToUndefined, z.coerce.number().int('page must be a whole number').min(1, 'page must be at least 1').max(REVIEW_PAGE_MAX, `page must be at most ${REVIEW_PAGE_MAX}`).default(REVIEW_PAGE_DEFAULT)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int('limit must be a whole number').min(1, 'limit must be at least 1').max(REVIEW_LIMIT_MAX, `limit must be at most ${REVIEW_LIMIT_MAX}`).default(REVIEW_LIMIT_DEFAULT)),
  })
  .strict();

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
