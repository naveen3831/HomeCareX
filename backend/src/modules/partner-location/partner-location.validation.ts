import { z } from "zod";

export const locationParamsSchema = z
  .object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") })
  .strict();

export const locationBodySchema = z
  .object({
    lat: z
      .number({
        required_error: "lat is required",
        invalid_type_error: "lat must be a number",
      })
      .min(-90)
      .max(90),
    lng: z
      .number({
        required_error: "lng is required",
        invalid_type_error: "lng must be a number",
      })
      .min(-180)
      .max(180),
    /** Metres. */
    accuracy: z.number().min(0).max(100_000).optional(),
    heading: z.number().min(0).max(360).optional(),
  })
  .strict();

export type LocationBody = z.infer<typeof locationBodySchema>;
