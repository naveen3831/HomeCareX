
import type {
  CookieOptions,
  NextFunction,
  Request,
  Response,
} from 'express';

import { authService } from './auth.service';

import {
  acceptInviteSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  inviteStaffSchema,
  loginSchema,
  parseBody,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyInviteSchema,
  verifyOtpSchema,
} from './auth.validation';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants';

/**
 * Refresh-token cookie options.
 */
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

/**
 * Read a cookie without requiring cookie-parser.
 */
export function readCookie(
  req: Request,
  name: string,
): string | undefined {
  const cookieHeader = req.headers.cookie ?? '';

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

/**
 * Clear refresh cookies at both supported paths.
 */
const clearRefreshCookies = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, {
    path: REFRESH_COOKIE_PATH,
  });

  res.clearCookie(REFRESH_COOKIE, {
    path: '/',
  });
};

/**
 * Forward asynchronous errors to Express error middleware.
 */
const wrap = (
  fn: (req: Request, res: Response) => Promise<unknown>,
) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void fn(req, res).catch(next);
};

/**
 * Get the authenticated user's ID.
 */
const getAuthenticatedUserId = (res: Response): string => {
  const userId = res.locals.auth?.sub;

  if (!userId || typeof userId !== 'string') {
    throw Object.assign(new Error('Authentication required'), {
      statusCode: 401,
    });
  }

  return userId;
};

export const authController = {
  /**
   * POST /api/v1/auth/login
   */
  login: wrap(async (req, res) => {
    const { user, accessToken, refreshToken } =
      await authService.login(
        parseBody(loginSchema, req.body),
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );

    clearRefreshCookies(res);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());

    res.json({
      success: true,
      data: { user, accessToken },
    });
  }),

  /**
   * POST /api/v1/auth/register
   */
  register: wrap(async (req, res) => {
    const { user, accessToken, refreshToken } =
      await authService.register(
        parseBody(registerSchema, req.body),
      );

    clearRefreshCookies(res);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());

    res.status(201).json({
      success: true,
      data: { user, accessToken },
    });
  }),

  /**
   * POST /api/v1/auth/refresh
   */
  refresh: wrap(async (req, res) => {
    const token = readCookie(req, REFRESH_COOKIE);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Refresh token cookie is missing',
      });
      return;
    }

    try {
      const { user, accessToken, refreshToken } =
        await authService.refresh(token);

      res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());

      res.json({
        success: true,
        data: { user, accessToken },
      });
    } catch (error) {
      clearRefreshCookies(res);
      throw error;
    }
  }),

  /**
   * POST /api/v1/auth/logout
   */
  logout: wrap(async (req, res) => {
    await authService.logout(readCookie(req, REFRESH_COOKIE));

    clearRefreshCookies(res);

    res.json({
      success: true,
      data: null,
    });
  }),

  /**
   * GET /api/v1/auth/me
   */
  me: wrap(async (_req, res) => {
    const userId = getAuthenticatedUserId(res);

    res.json({
      success: true,
      data: await authService.me(userId),
    });
  }),

  /**
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: wrap(async (req, res) => {
    const result = await authService.forgotPassword(
      parseBody(forgotPasswordSchema, req.body),
    );

    res.json(result);
  }),

  /**
   * POST /api/v1/auth/verify-otp
   */
  verifyOtp: wrap(async (req, res) => {
    const result = await authService.verifyOtp(
      parseBody(verifyOtpSchema, req.body),
    );

    res.json(result);
  }),

  /**
   * POST /api/v1/auth/resend-otp
   */
  resendOtp: wrap(async (req, res) => {
    const result = await authService.resendOtp(
      parseBody(resendOtpSchema, req.body),
    );

    res.json(result);
  }),

  /**
   * POST /api/v1/auth/reset-password
   */
  resetPassword: wrap(async (req, res) => {
    const result = await authService.resetPassword(
      parseBody(resetPasswordSchema, req.body),
    );

    clearRefreshCookies(res);
    res.json(result);
  }),

  /**
   * POST /api/v1/auth/change-password
   */
  changePassword: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);

    const input = parseBody(
      changePasswordSchema,
      req.body,
    );

    const data = await authService.changePassword(userId, input);

    clearRefreshCookies(res);

    res.json({
      success: true,
      data,
      message: 'Password updated. Please log in again.',
    });
  }),

  /**
   * GET /api/v1/auth/sessions
   */
  getSessions: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);
    const userAgent = req.headers['user-agent'];

    const ip =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)
        ?.split(',')[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const currentSid = (res.locals.auth as { sid?: string } | undefined)
      ?.sid;

    const data = await authService.getSessions(userId, {
      userAgent,
      ip,
      currentSid,
    });

    res.json({
      success: true,
      data,
    });
  }),

  /**
   * DELETE /api/v1/auth/sessions/:id
   */
  revokeSession: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);
    const sessionId = req.params.id;

    clearRefreshCookies(res);

    res.json({
      success: true,
      data: {
        revokedSessionsCount: result.revokedSessionsCount,
      },
      message: result.message,
    });
  }),

  /**
   * POST /api/v1/auth/verify-invite
   */
  verifyInvite: wrap(async (req, res) => {
    const payload = parseBody(
      verifyInviteSchema,
      req.body,
    );

    const result = await authService.verifyInvite(payload);

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * POST /api/v1/admin/staff
   */
  inviteStaff: wrap(async (req, res) => {
    const invitedBy =
      String(
        (res.locals.auth as { sub?: string } | undefined)?.sub ?? '',
      ) || undefined;

    const data = await authService.inviteStaff(
      parseBody(inviteStaffSchema, req.body),
      invitedBy,
    );

    res.status(201).json({
      success: true,
      data,
    });
  }),

  /**
   * POST /api/v1/admin/revoke-user-sessions/:userId
   */
  revokeUserSessions: wrap(async (req, res) => {
    const userId = req.params.userId ?? req.params.id;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
      return;
    }

    const result = await authService.revokeUserSessions(userId);

    res.json({
      success: true,
      data: {
        revokedSessionsCount: result.revokedSessionsCount,
      },
      message: result.message,
    });
  }),
};

export default authController;
