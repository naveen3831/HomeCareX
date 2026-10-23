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
  gender: z.enum(['male', 'female', 'other']).optional(),
  dob: z.string().optional(),
  avatar: z.string().optional(),
  idProofType: z.string().optional(),
  idProofNumber: z.string().optional(),
  idProofDocument: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  addressProofDocument: z.string().optional(),
  category: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().optional(),
  serviceRadiusKm: z.number().optional(),
  workingDays: z.array(z.string()).optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  accountHolder: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
  skills: z.array(z.string()).optional(),
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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password needs an uppercase letter')
      .regex(/[0-9]/, 'Password needs a number')
      .regex(/[^A-Za-z0-9]/, 'Password needs a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password cannot be the same as the current password',
    path: ['newPassword'],
  });

export const inviteStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  roleId: z.string().min(1, 'Role is required'),
});

export const verifyInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password needs an uppercase letter')
    .regex(/[0-9]/, 'Password needs a number')
    .regex(/[^A-Za-z0-9]/, 'Password needs a special character'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type VerifyInviteInput = z.infer<typeof verifyInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

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
