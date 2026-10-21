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

export const verifyStartBodySchema = z.object({
  otp: z.string().trim().min(1, "OTP is required"),
});
export type VerifyStartBody = z.infer<typeof verifyStartBodySchema>;

export const completeJobBodySchema = z.object({
  otp: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CompleteJobBody = z.infer<typeof completeJobBodySchema>;

export const extraChargeBodySchema = z.object({
  description: z.string().trim().min(1, "description is required").max(120),
  quantity: z.coerce.number().int().min(1).default(1),
  amount: z.coerce.number().min(1, "amount must be at least 1"),
  reason: z.string().trim().max(500).optional(),
});
export type ExtraChargeBody = z.infer<typeof extraChargeBodySchema>;

export const checklistItemParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id"),
  itemId: z.string().min(1, "itemId is required"),
});

export const checklistItemBodySchema = z.object({
  done: z.boolean(),
});
export type ChecklistItemBody = z.infer<typeof checklistItemBodySchema>;
