import { Router } from 'express';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { SETTINGS_MANAGE_PERMISSION } from './settings.constants';
import { settingsService } from './settings.service';

/** Mounted at /api/v1/admin/settings. Admin role + `settings:manage`. */
export const settingsRoutes = Router();
settingsRoutes.use(authenticate, requireAdmin, requirePermission(SETTINGS_MANAGE_PERMISSION));

// GET /admin/settings -> { sections: [{ id, label, description, settings: [{ key, label, value, description, type, min, max, ... }] }] }
settingsRoutes.get('/', asyncHandler(async (_req, res) => sendSuccess(res, await settingsService.list())));

// PUT /admin/settings  body: { values: { "slots.capacityPerSlot": 8, "tax.gstPercent": 12 } }
settingsRoutes.put(
  '/',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const result = await settingsService.updateMany(req.body?.values, { id, ip: req.ip ?? 'unknown' });
    sendSuccess(res, result, { message: result.changed.length ? 'Settings saved' : 'No changes' });
  }),
);

// PUT /admin/settings/:key  body: { value }   (single setting)
settingsRoutes.put(
  '/:key',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    sendSuccess(res, await settingsService.update(req.params.key, req.body?.value, { id, ip: req.ip ?? 'unknown' }));
  }),
);

export default settingsRoutes;
