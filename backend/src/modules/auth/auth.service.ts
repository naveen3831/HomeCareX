import crypto from "crypto";
import mongoose from "mongoose";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { authRepository } from "./auth.repository";
import { ensurePartnerProfile } from "../partners/partners.service";

import {
  ACCESS_TOKEN_TTL,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  REFRESH_TOKEN_TTL_DAYS,
  ROLE_HOME,
  ROLE_PERMISSIONS,
} from "./auth.constants";

import {
  HttpError,
  type AccessTokenPayload,
  type AuthUserDto,
  type RefreshTokenPayload,
} from "./auth.types";

import type {
  AcceptInviteInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  InviteStaffInput,
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  VerifyInviteInput,
  VerifyOtpInput,
} from "./auth.validation";

import type { UserRole } from "../../models/User";
import { StaffModel } from "../../models/Staff";

import { mailService } from "../../services/mail.service";
import { referralsService } from "../referrals/referrals.service";

const accessSecret = () =>
  process.env.JWT_SECRET || "dev_access_secret_change_me";

const refreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || `${accessSecret()}_refresh`;

const OTP_TTL_MINUTES = 10;

const MAX_OTP_ATTEMPTS = 5;

const RESET_TOKEN_TTL_MINUTES = 15;

const RESEND_COOLDOWN_MS = 30_000;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");

  if (!local || !domain) return "***";

  const visible =
    local.length <= 2
      ? `${local[0]}*`
      : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;

  return `${visible}@${domain}`;
}

function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashSecret(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex");
}

function parseUserAgent(ua?: string): string {
  if (!ua) return "Unknown Device";
  let browser = "Web Browser";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Google Chrome";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Apple Safari";
  else if (ua.includes("Postman")) browser = "Postman";

  let os = "Desktop";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

type UserDoc = NonNullable<Awaited<ReturnType<typeof authRepository.findById>>>;

export function toAuthUser(user: UserDoc): AuthUserDto {
  const role = user.role as UserRole;

  return {
    id: user.id,

    name: user.name,

    email: user.email,

    phone: user.phone ?? undefined,

    role,

    permissions: ROLE_PERMISSIONS[role] ?? [],

    home: ROLE_HOME[role] ?? "/",

    ...(user.staffRoleId ? { staffRoleId: user.staffRoleId } : {}),
  };
}

function issueTokens(user: UserDoc, sid?: string, sessionTokenVersion?: number) {
  const access: AccessTokenPayload = {
    sub: user.id,
    role: user.role as UserRole,
    ...(sid ? { sid } : {}),
  };

  const refresh: RefreshTokenPayload = {
    sub: user.id,
    v: sessionTokenVersion !== undefined ? sessionTokenVersion : user.tokenVersion,
    ...(sid ? { sid } : {}),
  };

  return {
    accessToken: jwt.sign(access, accessSecret(), {
      expiresIn: ACCESS_TOKEN_TTL,
    }),

    refreshToken: jwt.sign(refresh, refreshSecret(), {
      expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
    }),
  };
}

const revokedSessionIds = new Set<string>();

export function markSessionRevoked(sid: string) {
  if (sid) {
    revokedSessionIds.add(sid);
    if (revokedSessionIds.size > 10000) {
      const first = revokedSessionIds.values().next().value;
      if (first) revokedSessionIds.delete(first);
    }
  }
}

export function isSessionRevoked(sid: string): boolean {
  return Boolean(sid && revokedSessionIds.has(sid));
}

const sessionExpired = (code: string) =>
  new HttpError(401, "Your session has expired. Please log in again.", code);

const INVITE_TTL_HOURS = 72;

const invalidInvite = () =>
  new HttpError(
    400,
    "This invitation link is invalid or has expired. Ask an admin to send a new one.",
    "INVALID_INVITE_TOKEN",
  );

export const authService = {
  async login(
    { email, password }: LoginInput,
    sessionInfo?: { userAgent?: string; ip?: string },
  ) {
    const user = await authRepository.findByEmailWithPassword(email);

    // Same message for an unknown email and a wrong password, so accounts can't be probed.

    const invalid = new HttpError(
      401,
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );

    if (!user) throw invalid;

    if (user.status === "blocked") {
      throw new HttpError(
        403,
        "This account has been blocked. Please contact support.",
        "ACCOUNT_BLOCKED",
      );
    }

    if (user.status === "invited") {
      throw new HttpError(
        403,
        "Your invitation is still pending. Open the link in your invite email to set a password first.",
        "INVITE_PENDING",
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(
        423,
        `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
        "ACCOUNT_LOCKED",
      );
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      user.failedLogins = (user.failedLogins ?? 0) + 1;

      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);

        user.failedLogins = 0;
      }

      await user.save();

      throw invalid;
    }

    user.failedLogins = 0;

    user.lockedUntil = undefined;

    user.lastLoginAt = new Date();

    const sid = crypto.randomUUID();
    let sessionTokenVersion: number | undefined;
    if (sessionInfo) {
      sessionTokenVersion = 0;
      const device = parseUserAgent(sessionInfo.userAgent);
      const ipAddress = sessionInfo.ip || "127.0.0.1";
      if (!Array.isArray((user as any).sessions)) {
        (user as any).sessions = [];
      }
      (user as any).sessions = (user as any).sessions.filter(
        (s: any) => s.device !== device || s.ipAddress !== ipAddress,
      );
      (user as any).sessions.unshift({
        sessionId: sid,
        device,
        ipAddress,
        lastActiveAt: new Date(),
        userAgent: sessionInfo.userAgent,
        tokenVersion: 0,
      });
      if ((user as any).sessions.length > 10) {
        (user as any).sessions = (user as any).sessions.slice(0, 10);
      }
    }

    await user.save();

    return {
      user: toAuthUser(user),
      ...issueTokens(
        user,
        sessionInfo ? sid : undefined,
        sessionTokenVersion,
      ),
    };
  },

  async register(input: RegisterInput) {
    if (await authRepository.existsByEmailOrPhone(input.email, input.phone)) {
      throw new HttpError(
        409,
        "An account with this email or phone already exists",
        "DUPLICATE_ACCOUNT",
      );
    }

    const referrerId =
      input.referralCode && input.role === "customer"
        ? await referralsService.resolve(input.referralCode)
        : undefined;
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await authRepository.create({
      name: input.name,

      email: input.email,

      phone: input.phone,

      passwordHash,

      role: input.role,

      referralCode: input.referralCode,

      avatar: input.avatar,
      gender: input.gender,
    });

    if (referrerId && input.referralCode) {
      try {
        await referralsService.attach(user.id, input.referralCode, referrerId);
      } catch (error) {
        // Account creation has not been returned to the caller yet; undo this attempt on failure.
        await mongoose.model("User").deleteOne({ _id: user.id });
        throw error;
      }
    }

    if (user.role === "partner" && mongoose.connection.readyState === 1) {
      try {
        const partner = await ensurePartnerProfile(user.id);
        if (partner) {
          if (input.skills && input.skills.length > 0) {
            partner.skills = input.skills;
          }
          if (input.serviceRadiusKm) {
            partner.serviceRadiusKm = input.serviceRadiusKm;
          }
          if (
            input.accountHolder ||
            input.accountNumber ||
            input.ifsc ||
            input.upiId
          ) {
            partner.bankDetails = {
              accountHolder: input.accountHolder,
              accountLast4: input.accountNumber
                ? input.accountNumber.slice(-4)
                : undefined,
              ifsc: input.ifsc?.toUpperCase(),
              upiId: input.upiId,
            };
          }
          if (input.dob) {
            partner.dob = new Date(input.dob);
          }
          if (input.gender) {
            (partner as any).gender = input.gender;
          }
          if (input.idProofType || input.idProofNumber) {
            partner.idProof = {
              type: input.idProofType,
              number: input.idProofNumber,
            };
          }
          if (input.address || input.city || input.state || input.pincode) {
            partner.address = {
              line: input.address,
              city: input.city,
              state: input.state,
              pincode: input.pincode,
            };
          }
          if (input.experienceYears !== undefined) {
            partner.experienceYears = input.experienceYears;
          }
          if (
            input.workingDays ||
            input.workingHoursStart ||
            input.workingHoursEnd
          ) {
            partner.workingHours = {
              days: input.workingDays ?? [],
              start: input.workingHoursStart,
              end: input.workingHoursEnd,
            };
          }
          const docs: Array<{
            type: "id_proof" | "address_proof";
            url: string;
            status: "approved";
          }> = [];
          if (input.idProofDocument) {
            docs.push({
              type: "id_proof",
              url: input.idProofDocument,
              status: "approved",
            });
          }
          if (input.addressProofDocument) {
            docs.push({
              type: "address_proof",
              url: input.addressProofDocument,
              status: "approved",
            });
          }
          (partner as any).kyc = {
            ...(partner.kyc ?? {}),
            status: "approved",
            ...(docs.length > 0 ? { documents: docs } : {}),
          };
          await partner.save();
        }
      } catch (err) {
        console.error(
          "Partner profile creation failed during registration:",
          err,
        );
      }
    }

    try {
      await mailService.sendAccountCreatedEmail({
        name: user.name,

        email: user.email,

        role: user.role as UserRole,

        createdAt: user.createdAt,
      });
    } catch {
      console.error("Account-created email failed for user", user.id);
    }

    return { user: toAuthUser(user), ...issueTokens(user) };
  },

  /** Verifies the refresh cookie, rotates the token pair, and detects reuse. */

  async refresh(refreshToken?: string) {
    if (!refreshToken) throw sessionExpired("NO_REFRESH_TOKEN");

    let payload: RefreshTokenPayload;

    try {
      payload = jwt.verify(
        refreshToken,
        refreshSecret(),
      ) as RefreshTokenPayload;
    } catch {
      throw sessionExpired("INVALID_REFRESH_TOKEN");
    }

    const user = await authRepository.findById(payload.sub);

    if (!user || user.status === "blocked") {
      throw sessionExpired("REVOKED_REFRESH_TOKEN");
    }

    const currentVersion = user.tokenVersion ?? 0;

    // Per-session tracking when sid is present
    if (payload.sid) {
      const userSessions = Array.isArray((user as any).sessions)
        ? (user as any).sessions
        : [];
      const session = userSessions.find(
        (s: any) => s.sessionId === payload.sid,
      );

      // Session revoked or not found
      if (!session) {
        throw sessionExpired("REVOKED_REFRESH_TOKEN");
      }

      const currentSessionVersion = session.tokenVersion ?? 0;

      // Reuse detection for this session:
      if (payload.v < currentSessionVersion) {
        (user as any).sessions = userSessions.filter(
          (s: any) => s.sessionId !== payload.sid,
        );
        markSessionRevoked(payload.sid);
        await user.save();

        throw sessionExpired("REVOKED_REFRESH_TOKEN");
      }

      if (payload.v !== currentSessionVersion) {
        throw sessionExpired("REVOKED_REFRESH_TOKEN");
      }

      // Normal rotation for this session:
      session.tokenVersion = currentSessionVersion + 1;
      session.lastActiveAt = new Date();
      await user.save();

      return {
        user: toAuthUser(user),
        ...issueTokens(user, payload.sid, session.tokenVersion),
      };
    }

    // Reuse detection: If token version is older than current, the token was already rotated.

    // Invalidate the session / token family by bumping tokenVersion so any subsequent

    // tokens in this family are also invalidated.

    if (payload.v < currentVersion) {
      user.tokenVersion = currentVersion + 1;

      await user.save();

      throw sessionExpired("REVOKED_REFRESH_TOKEN");
    }

    if (payload.v !== currentVersion) {
      throw sessionExpired("REVOKED_REFRESH_TOKEN");
    }

    // Normal rotation: increment token version and persist

    user.tokenVersion = currentVersion + 1;

    await user.save();

    return { user: toAuthUser(user), ...issueTokens(user) };
  },

  /** Logout ends the caller session, or every session for legacy/test tokens. */

  async logout(refreshToken?: string) {
    if (!refreshToken) return;

    try {
      const payload = jwt.verify(
        refreshToken,
        refreshSecret(),
      ) as RefreshTokenPayload;

      const user = await authRepository.findById(payload.sub);

      if (user) {
        if (payload.sid) {
          markSessionRevoked(payload.sid);
          if (Array.isArray((user as any).sessions)) {
            (user as any).sessions = (user as any).sessions.filter(
              (s: any) => s.sessionId !== payload.sid,
            );
          }
        }
        if (!payload.sid && user.tokenVersion === payload.v) {
          user.tokenVersion += 1;
        }
        await user.save();
      }
    } catch {
      // Token already invalid: nothing to revoke.
    }
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, accessSecret()) as AccessTokenPayload;
      if (payload.sid && isSessionRevoked(payload.sid)) {
        throw sessionExpired("REVOKED_SESSION");
      }
      return payload;
    } catch (err: any) {
      if (err.status && err.code) throw err;
      throw sessionExpired("INVALID_ACCESS_TOKEN");
    }
  },

  async me(userId: string) {
    const user = await authRepository.findById(userId);

    if (!user || user.status === "blocked")
      throw sessionExpired("USER_NOT_FOUND");

    return toAuthUser(user);
  },

  /** Changes the password for an authenticated user. */
  async changePassword(
    userId: string,
    {
      currentPassword,
      newPassword,
    }: { currentPassword: string; newPassword: string },
  ): Promise<{ changed: true }> {
    const user = await authRepository.findByIdWithPassword(userId);

    if (!user || user.status === "blocked") {
      throw sessionExpired("USER_NOT_FOUND");
    }

    const validCurrentPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!validCurrentPassword) {
      throw new HttpError(
        400,
        "Current password is incorrect.",
        "INVALID_CURRENT_PASSWORD",
      );
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new HttpError(
        400,
        "New password must be different from the current password.",
        "SAME_PASSWORD",
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();

    return { changed: true };
  },

  /** Returns active sessions for the authenticated user. */
  async getSessions(
    userId: string,
    reqInfo: { userAgent?: string; ip?: string; currentSid?: string },
  ): Promise<
    Array<{
      id: string;
      device: string;
      ipAddress: string;
      lastActiveAt: string;
      isCurrent: boolean;
      location?: string;
    }>
  > {
    const user = await authRepository.findById(userId);
    if (!user || user.status === "blocked") {
      throw sessionExpired("USER_NOT_FOUND");
    }

    const currentDevice = parseUserAgent(reqInfo.userAgent);
    const currentIp = reqInfo.ip || "127.0.0.1";
    const userSessions = (user as any).sessions || [];

    if (userSessions.length === 0) {
      return [
        {
          id: reqInfo.currentSid || `sess_${user.id}_current`,
          device: currentDevice,
          ipAddress: currentIp,
          lastActiveAt: user.lastLoginAt
            ? user.lastLoginAt.toISOString()
            : new Date().toISOString(),
          isCurrent: true,
          location: "Current Device",
        },
      ];
    }

    let foundCurrent = false;
    const mapped = userSessions.map((s: any) => {
      const isCurrent = reqInfo.currentSid
        ? s.sessionId === reqInfo.currentSid
        : s.device === currentDevice && s.ipAddress === currentIp;

      if (isCurrent) foundCurrent = true;

      return {
        id: s.sessionId,
        device: s.device,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt
          ? new Date(s.lastActiveAt).toISOString()
          : new Date().toISOString(),
        isCurrent,
        location: isCurrent ? "Current Device" : "Active Device",
      };
    });

    if (!foundCurrent) {
      mapped.unshift({
        id: reqInfo.currentSid || `sess_${user.id}_current`,
        device: currentDevice,
        ipAddress: currentIp,
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
        location: "Current Device",
      });
    }

    mapped.sort((a: any, b: any) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return (
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );
    });

    return mapped;
  },

  /** Revokes an individual session. */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSid?: string,
  ): Promise<{ success: boolean; isCurrent: boolean; message: string }> {
    const user = await authRepository.findById(userId);
    if (!user || user.status === "blocked") {
      throw sessionExpired("USER_NOT_FOUND");
    }

    const isCurrent = Boolean(
      (currentSid && sessionId === currentSid) || sessionId === "current",
    );

    markSessionRevoked(sessionId);

    if (Array.isArray((user as any).sessions)) {
      (user as any).sessions = (user as any).sessions.filter(
        (s: any) => s.sessionId !== sessionId,
      );
    }

    if (isCurrent) {
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    await user.save();

    return {
      success: true,
      isCurrent,
      message: isCurrent ? "Current session revoked" : "Session revoked successfully",
    };
  },

  /** Logs out of all devices by clearing sessions and bumping tokenVersion. */
  async logoutAll(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user || user.status === "blocked") {
      throw sessionExpired("USER_NOT_FOUND");
    }

    if (Array.isArray((user as any).sessions)) {
      for (const s of (user as any).sessions) {
        if (s.sessionId) markSessionRevoked(s.sessionId);
      }
    }
    (user as any).sessions = [];
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return {
      success: true,
      revokedSessionsCount: 1,
      message: "Logged out from all devices",
    };
  },

  /** Admin operation: revokes all sessions for a specific target user. */
  async revokeUserSessions(targetUserId: string) {
    const user = await authRepository.findById(targetUserId);
    if (!user) {
      throw new HttpError(404, "User not found", "USER_NOT_FOUND");
    }

    if (Array.isArray((user as any).sessions)) {
      for (const s of (user as any).sessions) {
        if (s.sessionId) markSessionRevoked(s.sessionId);
      }
    }
    (user as any).sessions = [];
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return {
      success: true,
      revokedSessionsCount: 1,
      message: "All sessions for this user have been revoked",
    };
  },

  /** Generates and dispatches a secure 6-digit OTP for password reset. */

  async forgotPassword({ email }: ForgotPasswordInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await authRepository.findByEmail(normalizedEmail);

    if (user && user.status !== "blocked") {
      await issuePasswordResetOtp(user);
    }

    return {
      success: true,

      message: "If an account exists, a verification code has been sent.",
    };
  },

  /** Verifies a 6-digit OTP, marks it used, and returns a single-use reset token. */

  async verifyOtp({ email, otp }: VerifyOtpInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const cleanedOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanedOtp)) {
      throw new HttpError(
        400,
        "Enter a valid 6-digit verification code.",
        "INVALID_OTP_FORMAT",
      );
    }

    const otpDoc = await authRepository.findLatestOtp(
      normalizedEmail,
      "PASSWORD_RESET",
    );

    if (!otpDoc || otpDoc.expiresAt <= new Date()) {
      throw new HttpError(
        400,
        "This verification code has expired. Please request a new code.",
        "OTP_EXPIRED",
      );
    }

    if (otpDoc.usedAt) {
      throw new HttpError(
        400,
        "This verification code has already been used. Please request a new code.",
        "OTP_ALREADY_USED",
      );
    }

    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpError(
        400,
        "Too many attempts. Please request a new code.",
        "TOO_MANY_ATTEMPTS",
      );
    }

    const submittedHash = hashSecret(cleanedOtp);

    if (submittedHash !== otpDoc.hashedCode) {
      otpDoc.attempts += 1;

      await otpDoc.save();

      if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
        throw new HttpError(
          400,
          "Too many attempts. Please request a new code.",
          "TOO_MANY_ATTEMPTS",
        );
      }

      throw new HttpError(
        400,
        "The verification code is invalid. Please try again.",
        "INVALID_OTP",
      );
    }

    otpDoc.usedAt = new Date();

    await otpDoc.save();

    const user = await authRepository.findByEmail(normalizedEmail);

    if (!user || user.status === "blocked") {
      throw new HttpError(
        400,
        "The verification code is invalid. Please try again.",
        "INVALID_OTP",
      );
    }

    const rawResetToken = crypto.randomBytes(32).toString("hex");

    const resetTokenHash = hashSecret(rawResetToken);

    user.passwordResetTokenHash = resetTokenHash;

    user.passwordResetExpiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000,
    );

    await user.save();

    return {
      success: true,

      resetToken: rawResetToken,

      data: { resetToken: rawResetToken },

      message: "Code verified successfully.",
    };
  },

  /** Resends a fresh OTP after the cooldown window, returning the same generic message as forgotPassword. */

  async resendOtp({ email }: ResendOtpInput) {
    const normalizedEmail = email.trim().toLowerCase();

    const latestOtp = await authRepository.findLatestOtp(
      normalizedEmail,
      "PASSWORD_RESET",
    );

    if (
      latestOtp &&
      Date.now() - new Date(latestOtp.createdAt).getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new HttpError(
        429,
        "Please wait 30 seconds before requesting another code.",
        "RATE_LIMITED",
      );
    }

    const user = await authRepository.findByEmail(normalizedEmail);

    if (user && user.status !== "blocked") {
      await issuePasswordResetOtp(user);
    }

    return {
      success: true,

      message: "If an account exists, a verification code has been sent.",
    };
  },

  /**
   * Admin: invites a teammate. Creates the account in "invited" state with no usable password,
   * stores only the SHA-256 hash of a single-use token, and emails the accept-invite link.
   * Inviting an address that is still "invited" re-sends a fresh link.
   */
  async inviteStaff({ name, email, roleId }: InviteStaffInput, invitedBy?: string) {
    const existing = await authRepository.findByEmail(email);
    if (existing && existing.status !== "invited") {
      throw new HttpError(
        409,
        "Someone with this email already has an account.",
        "EMAIL_TAKEN",
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenHash = hashSecret(rawToken);
    const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000);

    let user: { id: string; name: string; email: string };
    if (existing) {
      existing.name = name;
      existing.inviteTokenHash = inviteTokenHash;
      existing.inviteExpiresAt = inviteExpiresAt;
      await existing.save();
      user = { id: String(existing._id), name: existing.name, email: existing.email };
    } else {
      // Random, never-disclosed password: nobody can log in until the invite is accepted.
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      const created = await authRepository.create({
        name,
        email,
        passwordHash: unusable,
        role: "admin",
        status: "invited",
        inviteTokenHash,
        inviteExpiresAt,
      });
      user = { id: String(created._id), name: created.name, email: created.email };
    }

    // The team record (role, status, who invited) lives in the `staff` collection; `users` only holds the login.
    await StaffModel.findOneAndUpdate(
      { userId: user.id },
      { $set: { name, email, roleId, status: "invited", ...(invitedBy ? { invitedBy } : {}) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const inviter = invitedBy ? await authRepository.findById(invitedBy) : null;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const inviteUrl = `${frontendUrl}/accept-invite?token=${rawToken}`;

    let emailSent = true;
    try {
      await mailService.sendStaffInviteEmail({ name, email, inviteUrl, invitedBy: inviter?.name });
    } catch (err) {
      emailSent = false;
      console.error("Staff invite email failed for user", user.id, err);
    }
    if (process.env.NODE_ENV !== "production") {
      console.info(`[DEV ONLY] Staff invite link for ${maskEmail(email)}: ${inviteUrl}`);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId,
      // TODO(rbac module): resolve the real role name / key from the Role model.
      roleName: "Admin",
      status: "invited" as const,
      lastLoginAt: null,
      emailSent,
    };
  },

  /** Public: lets the accept-invite page greet the person before they set a password. */
  async verifyInvite({ token }: VerifyInviteInput) {
    const user = await authRepository.findByInviteTokenHash(hashSecret(token));
    if (!user) throw invalidInvite();
    return { name: user.name, email: user.email };
  },

  /** Public: consumes the single-use invite token, sets the password and activates the account. */
  async acceptInvite({ token, password }: AcceptInviteInput) {
    const user = await authRepository.findByInviteTokenHash(hashSecret(token));
    if (!user) throw invalidInvite();

    user.passwordHash = await bcrypt.hash(password, 12);
    user.status = "active";
    user.inviteTokenHash = undefined;
    user.inviteExpiresAt = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();
    await StaffModel.updateOne({ userId: user.id }, { $set: { status: "active" } });

    return {
      email: user.email,
      message: "Your account is ready. Please log in with your new password.",
    };
  },

  /** Consumes the single-use reset token, resets password, and revokes all active sessions. */

  async resetPassword({ resetToken, token, newPassword }: ResetPasswordInput) {
    const tokenToVerify = (resetToken || token)?.trim();

    if (!tokenToVerify) {
      throw new HttpError(
        400,
        "Reset token is required.",
        "INVALID_RESET_TOKEN",
      );
    }

    const tokenHash = hashSecret(tokenToVerify);

    const user = await authRepository.findByResetTokenHash(tokenHash);

    if (!user || user.status === "blocked") {
      throw new HttpError(
        400,
        "This password reset link is invalid or has expired.",
        "INVALID_RESET_TOKEN",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    user.passwordHash = passwordHash;

    user.passwordResetTokenHash = undefined;

    user.passwordResetExpiresAt = undefined;

    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    user.failedLogins = 0;

    user.lockedUntil = undefined;

    await user.save();

    return {
      success: true,

      message:
        "Your password has been reset successfully. Please log in with your new password.",
    };
  },
};

async function issuePasswordResetOtp(user: UserDoc) {
  await authRepository.invalidateActiveOtps(user.email, "PASSWORD_RESET");

  const otp = generateSecureOtp();

  const hashedCode = hashSecret(otp);

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await authRepository.createOtp({
    userId: user.id,

    identifier: user.email,

    hashedCode,

    purpose: "PASSWORD_RESET",

    expiresAt,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[DEV ONLY] Password reset OTP generated for ${maskEmail(user.email)}: ${otp}`,
    );
  }

  try {
    await mailService.sendPasswordResetOtpEmail({
      name: user.name,

      email: user.email,

      otp,
    });
  } catch (err) {
    console.error("Password-reset OTP email failed for user", user.id, err);
  }
}
