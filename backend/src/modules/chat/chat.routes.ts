import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';
import { listMessages, sendMessage } from './chat.controller';
import { bookingParamsSchema, listQuerySchema, sendBodySchema } from './chat.validation';

/** Mounted at /bookings. Access is decided per booking in the service (customer / assigned partner / admin read). */
export const chatRoutes = Router();

/** 30 messages per minute per user per booking. */
const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => `chat:${req.user?.id ?? req.ip}:${req.params.id}`,
});

// GET /api/v1/bookings/:id/messages?limit=30&before=<messageId>
chatRoutes.get('/:id/messages', authenticate, validationMiddleware({ params: bookingParamsSchema, query: listQuerySchema }), listMessages);

// POST /api/v1/bookings/:id/messages  { text?, attachments?: [{ url }] }
chatRoutes.post(
  '/:id/messages',
  authenticate,
  sendLimiter,
  validationMiddleware({ params: bookingParamsSchema, body: sendBodySchema }),
  sendMessage,
);

export default chatRoutes;