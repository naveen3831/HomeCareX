import type { Request, Response } from "express";
import { getAuthUser } from "../../middleware/auth.middleware";
import { sendSuccess } from "../../utils/response";
import { ticketsService, type TicketActor } from "./tickets.service";
import type { TicketQuery } from "./tickets.validation";
import type { EvidenceFile } from "./tickets.upload";

const actor = (req: Request): TicketActor => {
  const user = getAuthUser(req);
  return { id: user.id, role: user.role === "admin" ? "admin" : "customer" };
};
const files = (res: Response): EvidenceFile[] =>
  (res.locals.ticketFiles as EvidenceFile[] | undefined) ?? [];
export const ticketsController = {
  async list(req: Request, res: Response) {
    const result = await ticketsService.list(
      getAuthUser(req).id,
      req.query as unknown as TicketQuery,
    );
    sendSuccess(res, result.items, { meta: result.meta });
  },
  async create(req: Request, res: Response) {
    sendSuccess(
      res,
      await ticketsService.create(getAuthUser(req).id, req.body, files(res)),
      { status: 201 },
    );
  },
  async get(req: Request, res: Response) {
    sendSuccess(
      res,
      await ticketsService.get(
        String(req.params.id),
        actor(req),
        req.query.before as string | undefined,
      ),
    );
  },
  async reply(req: Request, res: Response) {
    sendSuccess(
      res,
      await ticketsService.reply(
        String(req.params.id),
        actor(req),
        req.body.body,
        files(res),
      ),
      { status: 201 },
    );
  },
  async status(req: Request, res: Response) {
    await ticketsService.setStatus(
      String(req.params.id),
      req.body.status,
      actor(req),
    );
    const { adminTicketsService } =
      await import("../admin-tickets/admin-tickets.service");
    sendSuccess(res, await adminTicketsService.get(String(req.params.id)));
  },
  async evidence(req: Request, res: Response) {
    const file = await ticketsService.evidence(
      String(req.params.id),
      String(req.params.attachmentId),
      actor(req),
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`,
    );
    res.send(file.data);
  },
};
