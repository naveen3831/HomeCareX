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

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

/** Read a cookie without requiring cookie-parser. */
export function readCookie(req: Request, name: string): string | undefined {
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

const clearRefreshCookies = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
};

const wrap = (
  fn: (req: Request, res: Response) => Promise<unknown>,
) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void fn(req, res).catch(next);
};

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
  login: wrap(async (req, res) => {
    const { user, accessToken, refreshToken } =
      await authService.login(parseBody(loginSchema, req.body));

    clearRefreshCookies(res);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    res.json({ success: true, data: { user, accessToken } });
  }),

  register: wrap(async (req, res) => {
    const { user, accessToken, refreshToken } =
      await authService.register(parseBody(registerSchema, req.body));

    clearRefreshCookies(res);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    res.status(201).json({ success: true, data: { user, accessToken } });
  }),

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
      res.json({ success: true, data: { user, accessToken } });
    } catch (error) {
      clearRefreshCookies(res);
      throw error;
    }
  }),

  logout: wrap(async (req, res) => {
    await authService.logout(readCookie(req, REFRESH_COOKIE));
    clearRefreshCookies(res);
    res.json({ success: true, data: null });
  }),

  changePassword: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);
    const input = parseBody(changePasswordSchema, req.body);
    const data = await authService.changePassword(userId, input);

    clearRefreshCookies(res);
    res.json({
      success: true,
      data,
      message: 'Password updated. Please log in again.',
    });
  }),

  me: wrap(async (_req, res) => {
    const userId = getAuthenticatedUserId(res);
    res.json({ success: true, data: await authService.me(userId) });
  }),

  forgotPassword: wrap(async (req, res) => {
    const result = await authService.forgotPassword(
      parseBody(forgotPasswordSchema, req.body),
    );
    res.json(result);
  }),

  verifyOtp: wrap(async (req, res) => {
    const result = await authService.verifyOtp(
      parseBody(verifyOtpSchema, req.body),
    );
    res.json(result);
  }),

  resendOtp: wrap(async (req, res) => {
    const result = await authService.resendOtp(
      parseBody(resendOtpSchema, req.body),
    );
    res.json(result);
  }),

  resetPassword: wrap(async (req, res) => {
    const result = await authService.resetPassword(
      parseBody(resetPasswordSchema, req.body),
    );
    clearRefreshCookies(res);
    res.json(result);
  }),

  getSessions: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);
    const sessions = await authService.getSessions(userId, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
      currentSid: res.locals.auth?.sid,
    });
    res.json({ success: true, data: sessions });
  }),

  revokeSession: wrap(async (req, res) => {
    const userId = getAuthenticatedUserId(res);
    const result = await authService.revokeSession(
      userId,
      req.params.id,
      res.locals.auth?.sid,
    );
    if (result.isCurrent) clearRefreshCookies(res);
    res.json({ success: true, data: result, message: result.message });
  }),

  logoutAll: wrap(async (_req, res) => {
    const userId = getAuthenticatedUserId(res);
    const result = await authService.logoutAll(userId);
    clearRefreshCookies(res);
    res.json({ success: true, data: result, message: result.message });
  }),

  revokeUserSessions: wrap(async (req, res) => {
    const userId = req.params.userId ?? req.params.id;
    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required.' });
      return;
    }

    const result = await authService.revokeUserSessions(userId);
    res.json({ success: true, data: result, message: result.message });
  }),

  inviteStaff: wrap(async (req, res) => {
    const invitedBy = res.locals.auth?.sub;
    const data = await authService.inviteStaff(
      parseBody(inviteStaffSchema, req.body),
      typeof invitedBy === 'string' ? invitedBy : undefined,
    );
    res.status(201).json({ success: true, data });
  }),

  verifyInvite: wrap(async (req, res) => {
    const data = await authService.verifyInvite(
      parseBody(verifyInviteSchema, req.body),
    );
    res.json({ success: true, data });
  }),

  acceptInvite: wrap(async (req, res) => {
    const data = await authService.acceptInvite(
      parseBody(acceptInviteSchema, req.body),
    );
    res.json({ success: true, data });
  }),
};

export default authController;
