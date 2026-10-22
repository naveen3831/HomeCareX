import type { NextFunction, Request, Response } from 'express';
import * as service from './partner-tickets.service';
import { TicketError } from './partner-tickets.validation';

/** Auth middleware is expected to set req.user. Adjust this one helper if your project names it differently. */
type AuthedRequest = Request & { user?: { _id?: unknown; id?: unknown; userId?: unknown } };

function currentUserId(req: Request): string {
  const u = (req as AuthedRequest).user;
  const id = u?._id ?? u?.id ?? u?.userId;
  if (!id) throw new TicketError(401, 'Not authenticated');
  return String(id);
}

type Handler = (req: Request, res: Response) => Promise<void>;

/** Every success response is { success: true, data } because the frontend client reads res.data.data. */
const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};

const wrap =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((err: unknown) => {
      if (err instanceof TicketError) {
        res
          .status(err.status)
          .json({ success: false, message: err.message, ...(err.errors ? { errors: err.errors } : {}) });
        return;
      }
      next(err);
    });
  };

export const createTicket = wrap(async (req, res) => {
  const { ticket } = await service.createPartnerTicket(currentUserId(req), req.body);
  ok(res, ticket, 201);
});

export const listTickets = wrap(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const { tickets } = await service.listPartnerTickets(currentUserId(req), status);
  ok(res, tickets);
});

export const getTicket = wrap(async (req, res) => {
  ok(res, await service.getPartnerTicket(currentUserId(req), String(req.params.id)));
});

export const replyToTicket = wrap(async (req, res) => {
  const { message } = await service.replyToPartnerTicket(currentUserId(req), String(req.params.id), req.body);
  ok(res, message, 201);
});