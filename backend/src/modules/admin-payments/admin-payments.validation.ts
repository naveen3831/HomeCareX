import { z } from 'zod';
import { PAYMENT_STATUSES } from '../../models/Payment';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './admin-payments.constants';

/** '' (an empty form field) is treated as "not provided". */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date (YYYY-MM-DD)');

export const adminPaymentsQuerySchema = z
  .object({
    status: optional(
      z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(PAYMENT_STATUSES)),
    ),
    method: optional(z.string().trim().max(30)),
    from: optional(isoDate),
    to: optional(isoDate),
    customer: optional(z.string().trim().max(100)),
    booking: optional(z.string().trim().max(60)),
    search: optional(z.string().trim().max(100)),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    message: '"from" must be on or before "to"',
    path: ['from'],
  });