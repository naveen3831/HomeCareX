import { z } from "zod";

/** Same phone rule as the server: strips +91 / 91 and separators, then needs 10 digits starting 6-9. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s()-]/g, "");
  if (cleaned.startsWith("+91")) return cleaned.slice(3);
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned.slice(2);
  return cleaned;
}

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
  /** Optional; leaving it blank removes the number. */
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(normalizePhone(v)), { message: "Enter a valid 10-digit mobile number" }),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Mirrors the server's password rules so the form can explain each one before the request is sent. */
export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "num", label: "A number", test: (v: string) => /[0-9]/.test(v) },
  { id: "special", label: "A special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(1, "Enter a new password")
      .refine((v) => PASSWORD_RULES.every((r) => r.test(v)), { message: "Password doesn't meet all the rules below" }),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.confirmPassword === d.newPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((d) => !d.currentPassword || d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "New password must be different from your current one",
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** First error message per field from a zod result, for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
