import type { Request, Response } from 'express';
import { customerProfileService } from './customer-profile.service';

const uid = (res: Response): string => res.locals.auth.sub;

export const customerProfileController = {
  async get(_req: Request, res: Response) {
    res.json({ success: true, data: { profile: await customerProfileService.getProfile(uid(res)) } });
  },
  async update(req: Request, res: Response) {
    res.json({ success: true, data: { profile: await customerProfileService.updateProfile(uid(res), req.body) } });
  },
  async uploadAvatar(req: Request, res: Response) {
    const profile = await customerProfileService.setAvatar(uid(res), req.body, req.headers['content-type']?.split(';')[0]);
    res.json({ success: true, data: { profile } });
  },
  async removeAvatar(_req: Request, res: Response) {
    res.json({ success: true, data: { profile: await customerProfileService.removeAvatar(uid(res)) } });
  },
  async getPreferences(_req: Request, res: Response) {
    res.json({ success: true, data: { preferences: await customerProfileService.getPreferences(uid(res)) } });
  },
  async updatePreferences(req: Request, res: Response) {
    res.json({ success: true, data: { preferences: await customerProfileService.updatePreferences(uid(res), req.body) } });
  },
};
