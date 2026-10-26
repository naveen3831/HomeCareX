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

// `.strict()` rejects unknown query keys, so every supported key (limit, unread) must be listed here.
const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    unread: z.enum(['true', 'false']).optional(),
  })
  .strict();
const idParamsSchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid notification id') });

notificationsRoutes.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const { limit, unread } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const unreadOnly = unread === 'true';
    const [items, unreadCount] = await Promise.all([
      notificationsService.listForUser(id, limit, unreadOnly),
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
    await notificationsService.markRead(getAuthUser(req).id, req.params.id as string);
    sendSuccess(res, { ok: true });
  }),
);

export default notificationsRoutes;