import { z } from 'zod';
import { HttpError } from './auth.types';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .transform((val) => {
      const cleaned = val.replace(/[\s()-]/g, '');
      if (cleaned.startsWith('+91')) return cleaned.slice(3);
      if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
      return cleaned;
    })
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Enter a valid 10-digit mobile number',
    })
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password needs an uppercase letter')
    .regex(/[0-9]/, 'Password needs a number')
    .regex(/[^A-Za-z0-9]/, 'Password needs a special character'),
  confirmPassword: z.string().optional(),
  referralCode: z.string().trim().optional(),
  role: z.enum(['customer', 'partner']).default('customer'),
  avatar: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  idProofType: z.enum(['aadhaar', 'pan', 'voter_id', 'driving_license', 'passport']).optional(),
  idProofNumber: z.string().trim().optional(),
  idProofDocument: z.string().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode').optional().or(z.literal('')),
  addressProofDocument: z.string().optional(),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().min(0).optional(),
  serviceRadiusKm: z.number().min(1).max(100).optional(),
  workingDays: z.array(z.string()).optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  accountHolder: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC').optional().or(z.literal('')),
  upiId: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit verification code'),
});

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional(),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password needs an uppercase letter')
      .regex(/[0-9]/, 'Password needs a number')
      .regex(/[^A-Za-z0-9]/, 'Password needs a special character'),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => Boolean(data.resetToken || data.token), {
    message: 'Reset token is required',
    path: ['resetToken'],
  });

/** Signed-in password change: current + new (same strength rules as register / reset). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password needs an uppercase letter')
      .regex(/[0-9]/, 'Password needs a number')
      .regex(/[^A-Za-z0-9]/, 'Password needs a special character'),
    confirmPassword: z.string().optional(),
  })
  .refine((d) => d.confirmPassword === undefined || d.confirmPassword === d.newPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Parses a body or throws a 400 with per-field details. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request', 'VALIDATION_ERROR');
    err.details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw err;
  }
  return result.data;
}