
import { z } from 'zod';
import { isRealDate, toLocalDateString } from '../../utils/dates';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Get today's date using the configured business timezone (IST by default).
const todayStr = (): string => toLocalDateString(new Date());

export const createBlackoutSchema = z
  .object({
    date: z
      .string()
      .regex(DATE_REGEX, 'Use YYYY-MM-DD')
      .refine(isRealDate, 'Not a real calendar date'),

    reason: z
      .string()
      .trim()
      .min(1, 'Reason is required')
      .max(200),
  })
  .strict()
  .refine((data) => data.date >= todayStr(), {
    message: 'Cannot add a blackout date in the past',
    path: ['date'],
  });

// Date is fixed once created — to move a blackout, delete and re-add it.
export const updateBlackoutSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Reason is required')
      .max(200),
  })
  .strict();

export type CreateBlackoutInput = z.infer<typeof createBlackoutSchema>;
export type UpdateBlackoutInput = z.infer<typeof updateBlackoutSchema>;
