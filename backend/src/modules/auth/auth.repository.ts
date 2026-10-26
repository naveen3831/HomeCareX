import { UserModel } from '../../models/User';
import { OtpModel } from '../../models/Otp';

export const authRepository = {
  findByEmailWithPassword: (email: string) => UserModel.findOne({ email }).select('+passwordHash'),
  findByIdWithPassword: (id: string) => UserModel.findById(id).select('+passwordHash'),
  findByEmail: (email: string) => UserModel.findOne({ email }),
  findById: (id: string) => UserModel.findById(id),
  findByIdWithPassword: (id: string) => UserModel.findById(id).select('+passwordHash'),
  findByResetTokenHash: (tokenHash: string) =>
    UserModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetTokenHash'),
  findByInviteTokenHash: (tokenHash: string) =>
    UserModel.findOne({
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { $gt: new Date() },
    }).select('+inviteTokenHash'),
  existsByEmailOrPhone: (email: string, phone?: string) =>
    UserModel.exists(phone ? { $or: [{ email }, { phone }] } : { email }),
  create: (data: { name: string; email: string; phone?: string; passwordHash: string; role: string; referralCode?: string; gender?: string; avatar?: string; designation?: string }) =>
    UserModel.create(data),
  create: (data: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
    role: string;
    referralCode?: string;
    gender?: 'male' | 'female' | 'other';
    status?: 'active' | 'blocked' | 'invited';
    inviteTokenHash?: string;
    inviteExpiresAt?: Date;
  }) => UserModel.create(data),

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
