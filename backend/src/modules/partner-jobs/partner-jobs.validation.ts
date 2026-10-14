import { z } from "zod";

export const PARTNER_JOB_TARGETS = ["en_route", "arrived"] as const;
export type PartnerJobTarget = (typeof PARTNER_JOB_TARGETS)[number];

export const jobParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id"),
});

export const statusBodySchema = z.object({
  status: z.string().trim().min(1),
  reason: z.string().trim().max(300).optional(),
});

export type StatusBody = z.infer<typeof statusBodySchema>;

export const isPartnerTarget = (value: string): value is PartnerJobTarget =>
  PARTNER_JOB_TARGETS.includes(value as PartnerJobTarget);
