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

/** Body of POST /partner/jobs/:id/reject. The reason is optional for old clients; the partner app always sends it. */
export const rejectBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "Please tell us why you are rejecting (at least 3 characters)")
      .max(300, "Reason must be 300 characters or fewer")
      .optional(),
  })
  .strict()
  .default({});

export type RejectBody = z.infer<typeof rejectBodySchema>;

export const sosBodySchema = z
  .object({
    coordinates: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .nullable()
      .optional(),
  })
  .strict();

export type SosBody = z.infer<typeof sosBodySchema>;

/** Body of POST /partner/jobs/:id/verify-start. Sent as JSON or multipart (an optional photo is accepted and ignored). */
export const verifyStartBodySchema = z.object({
  otp: z.string({ required_error: "otp is required" }).trim().regex(/^\d{4,6}$/, "Enter the 4-digit code from the customer"),
});

export type VerifyStartBody = z.infer<typeof verifyStartBodySchema>;

/** Body of POST /partner/jobs/:id/complete. */
export const completeBodySchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export type CompleteBody = z.infer<typeof completeBodySchema>;

/** Body of POST /partner/jobs/:id/collect-payment. */
export const collectPaymentBodySchema = z
  .object({ method: z.enum(["cash", "upi"], { required_error: "method is required" }) })
  .strict();

export type CollectPaymentBody = z.infer<typeof collectPaymentBodySchema>;

/** Body of POST /partner/jobs/:id/rate-customer. */
export const rateCustomerBodySchema = z
  .object({
    rating: z.number({ required_error: "rating is required" }).int().min(1).max(5),
    comment: z.string().trim().max(300).optional(),
  })
  .strict();

export type RateCustomerBody = z.infer<typeof rateCustomerBodySchema>;

export const isPartnerTarget = (value: string): value is PartnerJobTarget =>
  PARTNER_JOB_TARGETS.includes(value as PartnerJobTarget);