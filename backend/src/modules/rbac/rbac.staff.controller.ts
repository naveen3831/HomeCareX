import type { Request, Response } from 'express';

import type { StaffStatusValue } from '../../models/Staff';
import { rbacStaffService } from './rbac.staff.service';

const actorOf = (req: Request, res: Response) => ({ id: String(res.locals.auth?.sub ?? ''), ip: req.ip ?? 'unknown' });

export const rbacStaffController = {
  async list(_req: Request, res: Response) {
    res.json({ success: true, data: await rbacStaffService.list() });
  },

  async changeRole(req: Request, res: Response) {
    const data = await rbacStaffService.changeRole(String(req.params.id), String(req.body?.roleId ?? ''), actorOf(req, res));
    res.json({ success: true, data });
  },

  async setStatus(req: Request, res: Response) {
    const data = await rbacStaffService.setStatus(String(req.params.id), req.body?.status as StaffStatusValue, actorOf(req, res));
    res.json({ success: true, data });
  },
};
