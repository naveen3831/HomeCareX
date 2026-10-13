import { Schema, model, type InferSchemaType } from 'mongoose';

export const USER_ROLES = ['admin', 'customer', 'partner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES: UserRole[] = ['admin'];

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'customer', index: true },
    referralCode: { type: String, trim: true },
    /** Partners only: the specialist type (Plumber, Electrician...). */
    designation: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    /** Bumped on logout / password change to invalidate every refresh token. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    /** Profile photo as a small data URL (the client downsizes it). Never selected by default so auth/admin reads stay light. */
    avatar: { type: String, select: false },
    /** Customer UI language (en | hi | te). */
    language: { type: String },
    /** Customer notification matrix: { booking: { push, sms, email, inApp }, ... }. Missing = defaults. */
    notificationPrefs: { type: Schema.Types.Mixed },
    /** SHA-256 hash of password reset token. */
    passwordResetTokenHash: { type: String, select: false },
    /** Expiration date for password reset token (30m). */
    passwordResetExpiresAt: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof UserSchema>;
export const UserModel = model('User', UserSchema);
export default UserModel;
