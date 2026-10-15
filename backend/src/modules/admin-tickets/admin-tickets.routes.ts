import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { TICKETS_MANAGE } from './admin-tickets.constants';
import { adminTicketsController } from './admin-tickets.controller';
import {
  assignTicketSchema,
  listAgentsQuerySchema,
  listTicketsQuerySchema,
  postMessageSchema,
  ticketIdParamSchema,
  updatePrioritySchema,
  updateStatusSchema,
} from './admin-tickets.validation';

/** Mounted at /api/v1/admin/tickets. Admin role + the `tickets:manage` permission. */
export const adminTicketsRoutes = Router();

adminTicketsRoutes.use(authenticate, requireAdmin, requirePermission(TICKETS_MANAGE));

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

// GET /admin/tickets/:id/messages  -> the thread, oldest first, internal notes included (this is the admin API)
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

// POST /admin/tickets/:id/messages  { body: string, internal?: boolean }  -> 201 + the saved message
// A reply reaches the requester live over the socket (`ticket:message`); an internal note never does.
adminTicketsRoutes.post(
  '/:id/messages',
  validate(ticketIdParamSchema, 'params'),
  validate(postMessageSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.postMessage(req, res)),
);

// PATCH /admin/tickets/:id/status  { status: 'open' | 'in_progress' | 'resolved' | 'closed' }
adminTicketsRoutes.patch(
  '/:id/status',
  validate(ticketIdParamSchema, 'params'),
  validate(updateStatusSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.status(req, res)),
);

// PATCH /admin/tickets/:id/priority  { priority: 'low' | 'normal' | 'high' | 'urgent' }  (escalate = urgent)
adminTicketsRoutes.patch(
  '/:id/priority',
  validate(ticketIdParamSchema, 'params'),
  validate(updatePrioritySchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.priority(req, res)),
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
