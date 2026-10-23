
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

/**
 * Mounted at /api/v1/admin/tickets.
 * Requires an authenticated admin with tickets:manage permission.
 */
export const adminTicketsRoutes = Router();

adminTicketsRoutes.use(authenticate, requireAdmin, requirePermission(TICKETS_MANAGE));
// GET /admin/tickets?status=&priority=&category=&assignee=&requester=&requesterRole=&booking=&sla=&from=&to=&page=&limit=
// One queue for customer AND partner tickets. status/priority/category accept comma lists (status=open,in_progress).
adminTicketsRoutes.get(
  '/',
  validate(listTicketsQuerySchema, 'query'),
  asyncHandler((req, res) => adminTicketsController.list(req, res)),
);

// GET /admin/tickets/:id
adminTicketsRoutes.get(
  '/:id',
  validate(ticketIdParamSchema, 'params'),
  asyncHandler((req, res) => adminTicketsController.get(req, res)),
);

// GET /admin/tickets/:id/messages
adminTicketsRoutes.get(
  '/:id/messages',
  validate(ticketIdParamSchema, 'params'),
  asyncHandler((req, res) => adminTicketsController.messages(req, res)),
);

// PATCH /admin/tickets/:id/assign
adminTicketsRoutes.patch(
  '/:id/assign',
  validate(ticketIdParamSchema, 'params'),
  validate(assignTicketSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.assign(req, res)),
);

// POST /admin/tickets/:id/messages
adminTicketsRoutes.post(
  '/:id/messages',
  validate(ticketIdParamSchema, 'params'),
  validate(postMessageSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.postMessage(req, res)),
);

// PATCH /admin/tickets/:id/status
adminTicketsRoutes.patch(
  '/:id/status',
  validate(ticketIdParamSchema, 'params'),
  validate(updateStatusSchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.status(req, res)),
);

// PATCH /admin/tickets/:id/priority
adminTicketsRoutes.patch(
  '/:id/priority',
  validate(ticketIdParamSchema, 'params'),
  validate(updatePrioritySchema, 'body'),
  asyncHandler((req, res) => adminTicketsController.priority(req, res)),
);

/**
 * Mounted at /api/v1/admin/ticket-assignees.
 * Returns admins who can be assigned to support tickets.
 */
export const adminStaffRoutes = Router();

adminStaffRoutes.use(
  authenticate,
  requireAdmin,
  requirePermission(TICKETS_MANAGE),
);

// GET /admin/ticket-assignees
adminStaffRoutes.get(
  '/',
  validate(listAgentsQuerySchema, 'query'),
  asyncHandler((req, res) => adminTicketsController.agents(req, res)),
);

export default adminTicketsRoutes;
