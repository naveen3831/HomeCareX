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
    unread: z.enum(["true", "false"]).optional(),
  })
  .strict();

const idParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid notification id"),
});

/**
 * GET /api/v1/notifications
 * List notifications belonging to the authenticated user.
 */
notificationsRoutes.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);

    // Validation middleware parses the query before the handler runs.
    const { limit, unread } = req.query as unknown as z.infer<
      typeof listQuerySchema
    >;

    const [items, unreadCount] = await Promise.all([
      notificationsService.listForUser(id, limit, unread === 'true'),
      notificationsService.unreadCount(id),
    ]);
    sendSuccess(res, items, { meta: { unread: unreadCount } });
  }),
);

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications belonging to the authenticated user as read.
 */
notificationsRoutes.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);

    await notificationsService.markAllRead(id);

    sendSuccess(res, { ok: true });
  }),
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark one of the authenticated user's notifications as read.
 */
notificationsRoutes.patch(
  '/:id/read',
  validate(idParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const notificationId = req.params.id as string;

    await notificationsService.markRead(id, notificationId);

    sendSuccess(res, { ok: true });
  }),
);

export default notificationsRoutes;