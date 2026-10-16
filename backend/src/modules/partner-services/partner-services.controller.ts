import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { partnerServicesService as service } from "./partner-services.service";
import type { ServiceAreaBody, ServicesBody } from "./partner-services.validation";

const userId = (res: Response) => (res.locals.auth as { sub: string }).sub;

export const getServices = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getServices(userId(res)));
});

export const updateServices = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.updateServices(userId(res), req.body as ServicesBody), {
    message: "Services updated",
  });
});

export const getServiceArea = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getArea(userId(res)));
});

export const updateServiceArea = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.updateArea(userId(res), req.body as ServiceAreaBody), {
    message: "Service area updated",
  });
});
