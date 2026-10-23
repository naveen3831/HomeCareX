import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { HttpError } from '../auth/auth.types';
import { ticketsService } from './tickets.service';

const actor = (req: Request) => {
  const user = getAuthUser(req);
  return { id: user.id, role: user.role === 'admin' ? 'admin' as const : 'customer' as const };
};

export const ticketsController = {
  async list(req: Request, res: Response) {
    const user = getAuthUser(req);
    const result = await ticketsService.list(user.id, req.query as never);
    res.json({ data: result.items, meta: result.meta });
  },

  async create(req: Request, res: Response) {
    const user = getAuthUser(req);
    const ticket = await ticketsService.create(
      user.id,
      req.body,
      res.locals.ticketFiles ?? [],
    );
    res.status(201).json({ data: ticket });
  },

  async get(req: Request, res: Response) {
    const result = await ticketsService.get(req.params.id, actor(req));
    res.json({ data: result });
  },

  async reply(req: Request, res: Response) {
    const result = await ticketsService.reply(
      req.params.id,
      actor(req),
      req.body.body,
      res.locals.ticketFiles ?? [],
    );
    res.status(201).json({ data: result });
  },

  async evidence(req: Request, res: Response) {
    const user = getAuthUser(req);
    if (user.role !== 'admin' && user.role !== 'customer') {
      throw new HttpError(403, 'You do not have access to this attachment.', 'FORBIDDEN');
    }
    const file = await ticketsService.evidence(req.params.id, req.params.attachmentId, {
      id: user.id,
      role: user.role,
    });
    res
      .set('Content-Type', file.mimeType)
      .set('Content-Length', String(file.sizeBytes))
      .set('Cache-Control', 'private, no-store')
      .set('X-Content-Type-Options', 'nosniff')
      .send(file.data);
  },
};

export default ticketsController;
