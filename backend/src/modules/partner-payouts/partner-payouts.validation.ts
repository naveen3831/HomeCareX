import { z } from 'zod';
import { PAYOUT_STATUSES } from '../../models/Payout';

/** GET /partner/payouts  ?status&limit */
export const payoutsQuerySchema = z
  .object({
    status: z.enum(PAYOUT_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type PayoutsQuery = z.infer<typeof payoutsQuerySchema>;

/** GET /partner/payouts/:id */
export const payoutIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid payout id'),
});