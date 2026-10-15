import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { adminTicketsService } from './admin-tickets.service';
import type { AssignTicketBody, ListTicketsQuery } from './admin-tickets.validation';

export const adminTicketsController = {
  /** GET /admin/tickets. `req.query` has already been parsed by the validate() middleware. */
  async list(req: Request, res: Response) {
    const admin = getAuthUser(req);
    const { items, meta } = await adminTicketsService.list(req.query as unknown as ListTicketsQuery, { id: admin.id });
    sendSuccess(res, items, { meta });
  },

  /** GET /admin/tickets/:id. */
  async get(req: Request, res: Response) {
    sendSuccess(res, await adminTicketsService.get(String(req.params.id)));
  },

  /** GET /admin/tickets/:id/messages. */
  async messages(req: Request, res: Response) {
    sendSuccess(res, await adminTicketsService.listMessages(String(req.params.id)));
  },

  /** GET /admin/staff?assignable=true. */
  async agents(_req: Request, res: Response) {
    sendSuccess(res, await adminTicketsService.listAssignableAgents());
  },

  /** PATCH /admin/tickets/:id/assign. Params and body are already validated. */
  async assign(req: Request, res: Response) {
    const admin = getAuthUser(req);
    const body = req.body as AssignTicketBody;
    const ticket = await adminTicketsService.assign(String(req.params.id), body, {
      id: admin.id,
      ip: req.ip ?? 'unknown',
    });
    sendSuccess(res, ticket, { message: body.assigneeId ? 'Ticket assigned' : 'Ticket unassigned' });
  },
};