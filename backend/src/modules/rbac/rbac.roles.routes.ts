import type { Request, Response } from 'express';
import { Router } from 'express';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { rbacRolesService } from './rbac.roles.service';

const actorOf = (req: Request, res: Response) => ({ id: String(res.locals.auth?.sub ?? ''), ip: req.ip ?? 'unknown' });

/** Mounted inside adminRoutes (so /api/v1/admin/...), after authenticate + requireAdmin. */
export const rbacRolesRoutes = Router();

rbacRolesRoutes.get('/permissions', requirePermission('roles:view'), asyncHandler(async (_req, res) => void res.json({ success: true, data: rbacRolesService.permissions() })));

rbacRolesRoutes.get('/roles', requirePermission('roles:view'), asyncHandler(async (_req, res) => void res.json({ success: true, data: await rbacRolesService.list() })));

rbacRolesRoutes.post(
  '/roles',
  requirePermission('roles:create'),
  asyncHandler(async (req, res) => void res.status(201).json({ success: true, data: await rbacRolesService.create(req.body, actorOf(req, res)) })),
);

rbacRolesRoutes.patch(
  '/roles/:id',
  requirePermission('roles:update'),
  asyncHandler(async (req, res) => void res.json({ success: true, data: await rbacRolesService.update(String(req.params.id), req.body, actorOf(req, res)) })),
);

rbacRolesRoutes.delete(
  '/roles/:id',
  requirePermission('roles:delete'),
  asyncHandler(async (req, res) => {
    await rbacRolesService.remove(String(req.params.id), actorOf(req, res));
    res.json({ success: true, data: { ok: true } });
  }),
);
