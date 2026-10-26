import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { sosService } from "./sos.service";
import type { TriggerSosBody } from "./sos.validation";

const userId = (res: Response) => (res.locals.auth as { sub: string }).sub;

export const triggerSos = asyncHandler(async (req: Request, res: Response) => {
  const result = await sosService.trigger(
    userId(res),
    req.body as TriggerSosBody,
    req.ip || "unknown",
  );
  sendSuccess(res, result, {
    status: result.duplicate ? 200 : 201,
    message: result.duplicate
      ? "SOS already raised. Help has been alerted."
      : "SOS sent. HomeCareX has been alerted.",
  });
});
