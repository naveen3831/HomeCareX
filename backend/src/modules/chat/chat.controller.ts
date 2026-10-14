import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { chatService, type Actor } from "./chat.service";
import type { ListQuery, SendBody } from "./chat.validation";

const actorOf = (res: Response): Actor => res.locals.auth as Actor;

export const listMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const page = await chatService.list(
      actorOf(res),
      req.params.id,
      req.query as unknown as ListQuery,
    );
    sendSuccess(res, page.messages, { meta: { nextCursor: page.nextCursor } });
  },
);

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await chatService.send(
    actorOf(res),
    req.params.id,
    req.body as SendBody,
  );
  sendSuccess(res, message, { status: 201, message: "Message sent" });
});
