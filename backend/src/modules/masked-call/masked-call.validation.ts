import { z } from "zod";

export const callParamsSchema = z
  .object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") })
  .strict();
