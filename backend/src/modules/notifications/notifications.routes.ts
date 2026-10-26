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

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unread: z.string().optional(),
});
  unread: z.enum(['true', 'false']).optional(),
}).strict();
const idParamsSchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid notification id') });

notificationsRoutes.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const { limit, unread } = listQuerySchema.parse(req.query);
    const [items, unreadCount] = await Promise.all([
      notificationsService.listForUser(id, limit, unread === 'true'),
      notificationsService.unreadCount(id),
    ]);
    sendSuccess(res, items, { meta: { unread: unreadCount } });
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
