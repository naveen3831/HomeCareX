import type { NextFunction, Request, Response } from 'express';
import { ROLE_PERMISSIONS } from '../modules/auth/auth.constants';
import { actionFor } from '../modules/rbac/rbac.constants';
import { can, rbacPermissions } from '../modules/rbac/rbac.permissions';
import type { UserRole } from '../models/User';
import { Errors } from '../utils/errors';

/**
 * Use after `authenticate`. Requires every listed permission (e.g. 'tickets:manage').
 * Partners and customers use the static ROLE_PERMISSIONS. An admin's static '*' is narrowed by the
 * admin's staff role (Role model), so the permission grid is enforced here, on the server.
 */
export const requirePermission =
  (...required: string[]) =>
  (_req: Request, res: Response, next: NextFunction) => {
    const role = res.locals.auth?.role as UserRole | undefined;
    if (!role) return next(Errors.unauthorized());
    const granted = ROLE_PERMISSIONS[role] ?? [];

    if (!granted.includes('*')) {
      const missing = required.find((p) => !granted.includes(p));
      return missing ? next(Errors.missingPermission(missing)) : next();
    }
    if (role !== 'admin') return next();

    rbacPermissions
      .resolveAdminPermissions(String(res.locals.auth?.sub ?? ''))
      .then((perms) => {
        if (perms === null) return next(); // no database to ask: keep the static rule
        const missing = required.find((p) => !can(perms, p));
        next(missing ? Errors.missingPermission(missing) : undefined);
      })
      .catch(next);
  };

/**
 * One guard for a whole admin module: GET needs `<resource>:view`, writes need the matching action
 * (create / update / delete, or `manage` for resources that only have that). Put it after authenticate + requireAdmin.
 */
export const requireResourceAccess =
  (resource: string) => (req: Request, res: Response, next: NextFunction) =>
    requirePermission(`${resource}:${actionFor(resource, req.method)}`)(req, res, next);

export const permissionMiddleware = requirePermission;
