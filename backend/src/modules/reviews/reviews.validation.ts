
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  REVIEW_COMMENT_MAX,
  REVIEW_LIMIT_DEFAULT,
  REVIEW_LIMIT_MAX,
  REVIEW_PAGE_DEFAULT,
  REVIEW_PAGE_MAX,
  REVIEW_TAGS,
} from './reviews.constants';

/** Treat an empty page or limit query parameter as not provided. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : value;

const objectId = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .refine(
      (value) =>
        /^[0-9a-fA-F]{24}$/.test(value) &&
        Types.ObjectId.isValid(value),
      `${label} must be a valid id`,
    );

export const createReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    message: z
      .string()
      .trim()
      .min(20, 'Review must be at least 20 characters')
      .max(2000, 'Review must be 2000 characters or fewer'),

    /** The server determines whether a review is verified. */
    serviceId: objectId('serviceId').optional(),
    bookingId: objectId('bookingId').optional(),
  })
  .refine(
    (value) => !value.bookingId || Boolean(value.serviceId),
    {
      path: ['serviceId'],
      message: 'serviceId is required when bookingId is given',
    },
  );

/** Review a completed booking. Service and partner IDs come from the booking. */
export const createBookingReviewSchema = z.object({
  rating: z
    .number({
      required_error: 'rating is required',
      invalid_type_error: 'rating must be a number from 1 to 5',
    })
    .int('rating must be a whole number from 1 to 5')
    .min(1, 'rating must be at least 1')
    .max(5, 'rating must be at most 5'),

  comment: z
    .string({ invalid_type_error: 'comment must be text' })
    .trim()
    .max(
      REVIEW_COMMENT_MAX,
      `comment must be ${REVIEW_COMMENT_MAX} characters or fewer`,
    )
    .optional()
    .transform((value) => (value ? value : undefined)),

  tags: z
    .array(
      z.enum(REVIEW_TAGS, {
        errorMap: () => ({
          message: `tags must be from: ${REVIEW_TAGS.join(', ')}`,
        }),
      }),
    )
    .max(REVIEW_TAGS.length, 'too many tags')
    .optional()
    .transform((value) => Array.from(new Set(value ?? []))),
});

export const bookingIdParamSchema = z.object({
  id: objectId('Booking id'),
});

/** Allowed review moderation statuses. */
export const reviewStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);

/**
 * Admin visibility moderation.
 * PATCH /admin/reviews/:id/visibility
 *
 * visible: false -> hide the review
 * visible: true  -> restore the review
 *
 * Only a real boolean is accepted; strings such as "false" are rejected.
 */
export const reviewVisibilitySchema = z.object({
  visible: z.boolean({
    required_error: 'visible is required',
    invalid_type_error: 'visible must be a boolean',
  }),
});

/** Admin review list filters. */
export const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: reviewStatusSchema.optional(),
});

export const serviceReviewsParamSchema = z.object({
  id: objectId('Service id'),
});

/** Public service-review pagination. Reject unexpected query parameters. */
export const serviceReviewsQuerySchema = z
  .object({
    page: z.preprocess(
      blankToUndefined,
      z
        .coerce.number()
        .int('page must be a whole number')
        .min(1, 'page must be at least 1')
        .max(
          REVIEW_PAGE_MAX,
          `page must be at most ${REVIEW_PAGE_MAX}`,
        )
        .default(REVIEW_PAGE_DEFAULT),
    ),

    limit: z.preprocess(
      blankToUndefined,
      z
        .coerce.number()
        .int('limit must be a whole number')
        .min(1, 'limit must be at least 1')
        .max(
          REVIEW_LIMIT_MAX,
          `limit must be at most ${REVIEW_LIMIT_MAX}`,
        )
        .default(REVIEW_LIMIT_DEFAULT),
    ),
  })
  .strict();

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export type ReviewVisibilityInput = z.infer<
  typeof reviewVisibilitySchema
>;
