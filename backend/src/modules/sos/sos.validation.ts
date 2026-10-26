import { z } from "zod";

/**
 * POST /partner/safety/sos
 * Both fields are optional: a partner must be able to raise SOS from the Safety page with no job open,
 * and without location permission. `partnerId` is never accepted: it comes from the token.
 */
export const triggerSosSchema = z
  .object({
    bookingId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid booking id")
      .optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(100_000).optional(),
      })
      .strict()
      .nullable()
      .optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type TriggerSosBody = z.infer<typeof triggerSosSchema>;
