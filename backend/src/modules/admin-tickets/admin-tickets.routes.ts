import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { TICKETS_MANAGE } from './admin-tickets.constants';
import { adminTicketsController } from './admin-tickets.controller';
import { assignTicketSchema, listAgentsQuerySchema, listTicketsQuerySchema, ticketIdParamSchema } from './admin-tickets.validation';
import { ticketsController } from '../tickets/tickets.controller';
import { receiveTicketFiles } from '../tickets/tickets.upload';
import { attachmentIdSchema, ticketMessageSchema, ticketStatusSchema } from '../tickets/tickets.validation';

/** Mounted at /api/v1/admin/tickets. Admin role + the `tickets:manage` permission. */
export const adminTicketsRoutes = Router();

adminTicketsRoutes.use(authenticate, requireAdmin, requirePermission(TICKETS_MANAGE));
adminTicketsRoutes.post('/:id/messages', validate(ticketIdParamSchema, 'params'), receiveTicketFiles, validate(ticketMessageSchema), asyncHandler(ticketsController.reply));
adminTicketsRoutes.patch('/:id/status', validate(ticketIdParamSchema, 'params'), validate(ticketStatusSchema), asyncHandler(ticketsController.status));
adminTicketsRoutes.get('/:id/attachments/:attachmentId', validate(attachmentIdSchema, 'params'), asyncHandler(ticketsController.evidence));

// GET /admin/tickets?status=&priority=&category=&assignee=&requester=&requesterRole=&booking=&sla=&from=&to=&page=&limit=
// One queue for customer AND partner tickets. status/priority/category accept comma lists (status=open,in_progress).
adminTicketsRoutes.get(
  '/',
  validate(listTicketsQuerySchema, 'query'),
  asyncHandler((req, res) => adminTicketsController.list(req, res)),
);

// GET /admin/tickets/:id  -> one ticket (same shape as a queue row)
adminTicketsRoutes.get(
  '/:id',
  validate(ticketIdParamSchema, 'params'),
  asyncHandler((req, res) => adminTicketsController.get(req, res)),
);

// GET /admin/tickets/:id/messages  -> the thread, oldest first (read-only for now)
adminTicketsRoutes.get(
  '/:id/messages',
  validate(ticketIdParamSchema, 'params'),
  asyncHandler((req, res) => adminTicketsController.messages(req, res)),
);

// PATCH /admin/tickets/:id/assign  { assigneeId: "<admin user id>" | null }
adminTicketsRoutes.patch(
  '/:id/assign',
  validate(ticketIdParamSchema, 'params'),
  validate(assignTicketSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.assign(req, res)),
);

/**
 * Mounted at /api/v1/admin/staff. Only the assignee picker's list for now: admins who can take a ticket.
 * Same guard as the queue, so anyone who can open Support can fill the dropdown.
 */
export const adminStaffRoutes = Router();

adminStaffRoutes.use(authenticate, requireAdmin, requirePermission(TICKETS_MANAGE));

// GET /admin/staff?assignable=true -> [{ id, name, email }]
adminStaffRoutes.get(
  '/',
  validate(listAgentsQuerySchema, 'query'),
  asyncHandler((req, res) => adminTicketsController.agents(req, res)),
);

export default adminTicketsRoutes;
