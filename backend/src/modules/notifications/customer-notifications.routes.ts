import { Router } from 'express';
import { z } from 'zod';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { HttpError } from '../auth/auth.types';
import { NOTIFICATION_GROUPS } from './notifications.constants';
import { notificationsService } from './notifications.service';

/** Mounted at /api/v1/customer/notifications. Customers only, and only ever their own notifications. */
export const customerNotificationsRoutes = Router();
customerNotificationsRoutes.use(authenticate, requireRole('customer'));

const listQuerySchema = z
  .object({
    group: z.enum(NOTIFICATION_GROUPS).optional(),
    unread: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

// GET /customer/notifications?group=booking&unread=true&limit=50
customerNotificationsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid filters', 'VALIDATION_ERROR');
    const { items, unread, groups } = await notificationsService.listForCustomer(getAuthUser(req).id, {
      group: parsed.data.group,
      unreadOnly: parsed.data.unread === 'true',
      limit: parsed.data.limit,
    });
    sendSuccess(res, items, { meta: { unread, groups } });
  }),
);

// PATCH /customer/notifications/read-all
customerNotificationsRoutes.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { updated: await notificationsService.markAllReadForCustomer(getAuthUser(req).id) });
  }),
);

// PATCH /customer/notifications/:id/read
customerNotificationsRoutes.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await notificationsService.markReadForCustomer(getAuthUser(req).id, req.params.id));
  }),
);

// DELETE /customer/notifications/:id  (swipe to delete)
customerNotificationsRoutes.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await notificationsService.deleteForCustomer(getAuthUser(req).id, req.params.id);
    sendSuccess(res, { deleted: 1 });
  }),
);

// DELETE /customer/notifications  (delete all of my notifications)
customerNotificationsRoutes.delete(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { deleted: await notificationsService.deleteAllForCustomer(getAuthUser(req).id) });
  }),
);

export default customerNotificationsRoutes;
