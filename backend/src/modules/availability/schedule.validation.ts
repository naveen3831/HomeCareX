import { z } from 'zod';
import { isRealDate } from '../../utils/dates';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const getScheduleQuerySchema = z
  .object({
    from: z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD').refine(isRealDate, 'Not a real calendar date').optional(),
    to: z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD').refine(isRealDate, 'Not a real calendar date').optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'from must be on or before to',
    path: ['to'],
  });

export type GetScheduleQuery = z.infer<typeof getScheduleQuerySchema>;