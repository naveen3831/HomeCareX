import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { notificationsService } from './notifications.service';

/** Mounted at /api/v1/notifications. Any signed-in user, own notifications only. */
export const notificationsRoutes = Router();
notificationsRoutes.use(authenticate);

const listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }).strict();
const idParamsSchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid notification id') });

notificationsRoutes.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
<<<<<<< HEAD
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? ''), 10) || 30, 1), 100);
    const unreadOnly = req.query.unread === 'true';
    const [items, unread] = await Promise.all([notificationsService.listForUser(id, limit, unreadOnly), notificationsService.unreadCount(id)]);
=======
    const { limit } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const [items, unread] = await Promise.all([notificationsService.listForUser(id, limit), notificationsService.unreadCount(id)]);
>>>>>>> origin/develop
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
  validate(idParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(getAuthUser(req).id, req.params.id);
    sendSuccess(res, { ok: true });
  }),
);

export default notificationsRoutes;
