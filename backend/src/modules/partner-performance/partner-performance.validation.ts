import { z } from 'zod';

/**
 * Both endpoints always answer for the signed-in partner. `partnerId` is accepted only so that someone else's id
 * can be refused with 403 instead of being silently ignored. Any other query field is a 400.
 */
export const performanceQuerySchema = z
  .object({ partnerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid partner id').optional() })
  .strict();

export type PerformanceQuery = z.infer<typeof performanceQuerySchema>;