import { z } from "zod";

/** Letters, numbers, spaces and . , & ' / - ( ) only. Collapses extra spaces. */
export const requestSkillSchema = z.object({
  name: z
    .string({ required_error: "Skill name is required" })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Skill name must be at least 2 characters")
        .max(60, "Skill name must be at most 60 characters")
        .regex(/^[\p{L}\p{N} .,&'/()-]+$/u, "Skill name has characters that are not allowed"),
    ),
});
export type RequestSkillBody = z.infer<typeof requestSkillSchema>;

export const reviewSkillSchema = z.object({
  note: z.string().trim().max(300, "Note must be at most 300 characters").optional(),
});
export type ReviewSkillBody = z.infer<typeof reviewSkillSchema>;
