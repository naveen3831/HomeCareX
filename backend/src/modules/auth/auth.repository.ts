import { UserModel } from '../../models/User';
import { OtpModel } from '../../models/Otp';

export const authRepository = {
  findByEmailWithPassword: (email: string) => UserModel.findOne({ email }).select('+passwordHash'),
  findByIdWithPassword: (id: string) => UserModel.findById(id).select('+passwordHash'),
  findByEmail: (email: string) => UserModel.findOne({ email }),
  findById: (id: string) => UserModel.findById(id),
  findByResetTokenHash: (tokenHash: string) =>
    UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetTokenHash'),
  existsByEmailOrPhone: (email: string, phone?: string) =>
    UserModel.exists(phone ? { $or: [{ email }, { phone }] } : { email }),
  create: (data: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
    role: string;
    gender?: 'male' | 'female' | 'other';
    referralCode?: string;
    status?: 'active' | 'blocked' | 'invited';
    inviteTokenHash?: string;
    inviteExpiresAt?: Date;
  }) =>
    UserModel.create(data),
  findByInviteTokenHash: (tokenHash: string) =>
    UserModel.findOne({
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { $gt: new Date() },
      status: 'invited',
    }).select('+passwordHash +inviteTokenHash'),

  // OTP repository methods
  createOtp: (data: {
    userId?: string;
    identifier: string;
    hashedCode: string;
    purpose?: 'PASSWORD_RESET';
    expiresAt: Date;
  }) => OtpModel.create(data),

  findLatestOtp: (identifier: string, purpose: string = 'PASSWORD_RESET') =>
    OtpModel.findOne({ identifier, purpose }).select('+hashedCode').sort({ createdAt: -1 }),

  invalidateActiveOtps: (identifier: string, purpose: string = 'PASSWORD_RESET') =>
    OtpModel.updateMany(
      { identifier, purpose, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { expiresAt: new Date() } },
    ),
};
