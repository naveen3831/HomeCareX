import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { settingsService } from './settings.service';

/** Mounted at /api/v1/site-settings. Public: the website footer reads its contact details and social links here. */
export const publicSettingsRoutes = Router();

// GET /site-settings -> { phone, email, hours, country, social: { facebook, instagram, x, linkedin } }
publicSettingsRoutes.get('/', asyncHandler(async (_req, res) => sendSuccess(res, await settingsService.publicSite())));

export default publicSettingsRoutes;