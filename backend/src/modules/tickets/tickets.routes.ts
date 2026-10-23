import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validate, validationMiddleware } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ticketsController } from './tickets.controller';
import {
  createTicketSchema,
  attachmentIdSchema,
  ticketIdSchema,
  ticketMessageSchema,
  ticketQuerySchema,
} from './tickets.validation';
import { receiveTicketFiles } from './tickets.upload';

export const ticketsRoutes = Router();

ticketsRoutes.use(authMiddleware, roleMiddleware('customer'));
ticketsRoutes.get(
  '/',
  validationMiddleware({ query: ticketQuerySchema }),
  asyncHandler(ticketsController.list),
);
ticketsRoutes.post(
  '/',
  receiveTicketFiles,
  validationMiddleware({ body: createTicketSchema }),
  asyncHandler(ticketsController.create),
);
ticketsRoutes.get(
  '/:id/attachments/:attachmentId',
  validate(attachmentIdSchema, 'params'),
  asyncHandler(ticketsController.evidence),
);
ticketsRoutes.get(
  '/:id',
  validate(ticketIdSchema, 'params'),
  asyncHandler(ticketsController.get),
);
ticketsRoutes.get(
  '/:id/messages',
  validate(ticketIdSchema, 'params'),
  asyncHandler(ticketsController.get),
);
ticketsRoutes.post(
  '/:id/messages',
  validate(ticketIdSchema, 'params'),
  receiveTicketFiles,
  validationMiddleware({ body: ticketMessageSchema }),
  asyncHandler(ticketsController.reply),
);

export default ticketsRoutes;
