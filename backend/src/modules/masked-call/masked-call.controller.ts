import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { maskedCallService } from "./masked-call.service";

export const startMaskedCall = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    sendSuccess(res, await maskedCallService.startCall(sub, req.params.id), {
      status: 201,
      message: "Masked call ready",
    });
  },
);
