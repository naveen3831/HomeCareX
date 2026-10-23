
import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';

import { authService } from '../modules/auth/auth.service';
import { AppError } from '../utils/AppError';
import type { UserRole } from '../models/User';

export const USER_ROLES: readonly UserRole[] = [
  'customer',
  'partner',
  'admin',
];

export interface AuthUser {
  id: string;
  role: UserRole;
}

// Extend Express Request to include the authenticated user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Requires Authorization: Bearer <access token>.
 * Verifies the token and sets req.user and res.locals.auth.
 */
export const authMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;

  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined;

  if (!token) {
    return next(
      new AppError(
        401,
        'UNAUTHENTICATED',
        'Authentication token is missing',
      ),
    );
  }

  try {
    const payload = authService.verifyAccessToken(token);

    // Attach the authenticated user for downstream handlers.
    res.locals.auth = payload;

    req.user = {
      id: payload.sub,
      role: payload.role as UserRole,
    };

    return next();
  } catch (err) {
    // Pass invalid or expired token errors to the global error handler.
    return next(err);
  }
};

/**
 * Returns the authenticated user or throws 401.
 * Use this in controllers protected by authMiddleware.
 */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(
      401,
      'UNAUTHENTICATED',
      'Authentication is required',
    );
  }

  return req.user;
}

/**
 * Alias maintained for routes importing `authenticate`.
 */
export const authenticate = authMiddleware;

/**
 * Optional authentication:
 * If `Authorization: Bearer <token>` is present, verifies the token and sets req.user.
 * If missing or invalid, does not fail; proceeds with req.user undefined.
 */
export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return next();
  }

  try {
    const payload = authService.verifyAccessToken(token);
    res.locals.auth = payload;
    req.user = { id: payload.sub, role: payload.role as UserRole };
  } catch {
    // Proceed unauthenticated
  }

  return next();
};
