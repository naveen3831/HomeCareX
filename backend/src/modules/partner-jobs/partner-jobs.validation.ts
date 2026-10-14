import { z } from "zod";

export const PARTNER_JOB_TARGETS = ["en_route", "arrived"] as const;
export type PartnerJobTarget = (typeof PARTNER_JOB_TARGETS)[number];

export const jobParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id"),
});

/** Any status string is accepted here so the service can answer 422 (not 400) for transitions a partner may not make. */
export const statusBodySchema = z
  .object({
    status: z.string({ required_error: "status is required" }).min(1, "status is required"),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export type StatusBody = z.infer<typeof statusBodySchema>;

export const isPartnerTarget = (value: string): value is PartnerJobTarget =>
  PARTNER_JOB_TARGETS.includes(value as PartnerJobTarget);
