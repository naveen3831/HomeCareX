import { Router } from 'express';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { notificationsService } from './notifications.service';

/** Mounted at /api/v1/notifications. Any signed-in user, own notifications only. */
export const notificationsRoutes = Router();
notificationsRoutes.use(authenticate);

notificationsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? ''), 10) || 30, 1), 100);
    const unreadOnly = req.query.unread === 'true';
    const [items, unread] = await Promise.all([notificationsService.listForUser(id, limit, unreadOnly), notificationsService.unreadCount(id)]);
    sendSuccess(res, items, { meta: { unread } });
  }),
);

notificationsRoutes.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationsService.markAllRead(getAuthUser(req).id);
    sendSuccess(res, { ok: true });
  }),
);

notificationsRoutes.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(getAuthUser(req).id, req.params.id);
    sendSuccess(res, { ok: true });
  }),
);

export default notificationsRoutes;
