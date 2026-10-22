import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerSettingsService } from './partner-settings.service';
import type { NotificationsPatch, PrivacyPatch, SecurityPatch, SettingsPatch } from './partner-settings.validation';

const userIdOf = (res: Response): string => (res.locals.auth as { sub: string }).sub;

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await partnerSettingsService.get(userIdOf(res)));
});

// `validate` has already replaced req.body with the parsed, strict value.
export const patchSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await partnerSettingsService.update(userIdOf(res), req.body as SettingsPatch));
});

export const patchNotifications = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await partnerSettingsService.updateNotifications(userIdOf(res), req.body as NotificationsPatch));
});

export const patchPrivacy = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await partnerSettingsService.updatePrivacy(userIdOf(res), req.body as PrivacyPatch));
});

export const patchSecurity = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await partnerSettingsService.updateSecurity(userIdOf(res), req.body as SecurityPatch));
});