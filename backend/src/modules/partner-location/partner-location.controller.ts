import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { partnerLocationService } from "./partner-location.service";
import type { LocationBody } from "./partner-location.validation";

const userId = (res: Response) => (res.locals.auth as { sub: string }).sub;

export const updateLocation = asyncHandler(
  async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await partnerLocationService.update(
        userId(res),
        req.params.id,
        req.body as LocationBody,
      ),
      { message: "Location updated" },
    );
  },
);

export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await partnerLocationService.get(userId(res), req.params.id),
  );
});

export const stopSharing = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await partnerLocationService.stop(userId(res), req.params.id),
    { message: "Location sharing stopped" },
  );
});
