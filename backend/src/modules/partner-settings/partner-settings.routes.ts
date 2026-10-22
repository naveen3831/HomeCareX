import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { authController } from '../auth/auth.controller';
import {
  getSettings,
  patchNotifications,
  patchPrivacy,
  patchSecurity,
  patchSettings,
} from './partner-settings.controller';
import {
  notificationsPatchSchema,
  privacyPatchSchema,
  securityPatchSchema,
  settingsPatchSchema,
} from './partner-settings.validation';

export const partnerSettingsRoutes = Router();

const read = [authenticate, requireRole('partner'), requirePermission('partner:settings:read')];
const write = [authenticate, requireRole('partner'), requirePermission('partner:settings:write')];

// GET /api/v1/partner/settings
partnerSettingsRoutes.get('/', ...read, getSettings);

// PATCH /api/v1/partner/settings  { language?, notifications?, privacy?, security? }
partnerSettingsRoutes.patch('/', ...write, validate(settingsPatchSchema, 'body'), patchSettings);

// PATCH /api/v1/partner/settings/notifications | /privacy | /security
partnerSettingsRoutes.patch('/notifications', ...write, validate(notificationsPatchSchema, 'body'), patchNotifications);
partnerSettingsRoutes.patch('/privacy', ...write, validate(privacyPatchSchema, 'body'), patchPrivacy);
partnerSettingsRoutes.patch('/security', ...write, validate(securityPatchSchema, 'body'), patchSecurity);

// Sessions and logout-all are central auth's (Nithya's): the same handlers, no duplicated logic here.
// GET /api/v1/partner/settings/sessions
partnerSettingsRoutes.get('/sessions', ...read, authController.getSessions);
// POST /api/v1/partner/settings/logout-all
partnerSettingsRoutes.post('/logout-all', ...write, authController.logoutAll);

export default partnerSettingsRoutes;