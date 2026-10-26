import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ticketsController as c } from './tickets.controller';
import { receiveTicketFiles } from './tickets.upload';
import {
  attachmentIdSchema,
  createTicketSchema,
  listTicketsSchema,
  objectId,
  ticketIdSchema,
  ticketMessageSchema,
} from './tickets.validation';

export const ticketsRoutes = Router();
ticketsRoutes.use(authenticate, requireRole('customer'));
ticketsRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
ticketsRoutes.get(
  '/',
  validate(listTicketsSchema, 'query'),
  asyncHandler(c.list),
);
ticketsRoutes.post(
  '/',
  receiveTicketFiles,
  validate(createTicketSchema),
  asyncHandler(c.create),
);
ticketsRoutes.get(
  '/:id',
  validate(ticketIdSchema, 'params'),
  validate(z.object({ before: objectId.optional() }).strict(), 'query'),
  asyncHandler(c.get),
);
ticketsRoutes.post(
  '/:id/messages',
  validate(ticketIdSchema, 'params'),
  receiveTicketFiles,
  validate(ticketMessageSchema),
  asyncHandler(c.reply),
);
ticketsRoutes.get(
  '/:id/attachments/:attachmentId',
  validate(attachmentIdSchema, 'params'),
  asyncHandler(c.evidence),
);
