
import { UserModel } from '../../models/User';
import { OtpModel } from '../../models/Otp';

type CreateUserData = {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: string;
  referralCode?: string;
  gender?: 'male' | 'female' | 'other';
  avatar?: string;
  designation?: string;
  status?: 'active' | 'blocked' | 'invited';
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
};

type CreateOtpData = {
  userId?: string;
  identifier: string;
  hashedCode: string;
  purpose?: 'PASSWORD_RESET';
  expiresAt: Date;
};

export const authRepository = {
  findByEmailWithPassword: (email: string) =>
    UserModel.findOne({ email }).select('+passwordHash'),

  findByIdWithPassword: (id: string) =>
    UserModel.findById(id).select('+passwordHash'),

  findByEmail: (email: string) =>
    UserModel.findOne({ email }),

  findById: (id: string) =>
    UserModel.findById(id),

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
    UserModel.exists(
      phone
        ? { $or: [{ email }, { phone }] }
        : { email },
    ),

  create: (data: CreateUserData) =>
    UserModel.create(data),

  // OTP repository methods

  createOtp: (data: CreateOtpData) =>
    OtpModel.create(data),

  findLatestOtp: (
    identifier: string,
    purpose: string = 'PASSWORD_RESET',
  ) =>
    OtpModel.findOne({ identifier, purpose })
      .select('+hashedCode')
      .sort({ createdAt: -1 }),

  invalidateActiveOtps: (
    identifier: string,
    purpose: string = 'PASSWORD_RESET',
  ) =>
    OtpModel.updateMany(
      {
        identifier,
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { expiresAt: new Date() },
      },
    ),
};
