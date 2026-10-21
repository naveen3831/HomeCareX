import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { partnerJobsService } from "./partner-jobs.service";
import type { StatusBody } from "./partner-jobs.validation";

export const listPartnerJobs = asyncHandler(
  async (_req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    sendSuccess(res, await partnerJobsService.listLiveJobs(sub));
  },
);

export const getPartnerJob = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    sendSuccess(res, await partnerJobsService.getJob(sub, req.params.id));
  },
);

export const listJobRequests = asyncHandler(
  async (_req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    sendSuccess(res, await partnerJobsService.listRequests(sub));
  },
);

export const acceptJobOffer = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const result = await partnerJobsService.acceptOffer(sub, req.params.id);
    sendSuccess(res, result, { message: result.message });
  },
);

export const rejectJobOffer = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const result = await partnerJobsService.rejectOffer(sub, req.params.id);
    sendSuccess(res, result, { message: result.message });
  },
);

export const updateBookingStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { status, reason } = req.body as StatusBody;
    sendSuccess(
      res,
      await partnerJobsService.updateStatus(sub, req.params.id, status, reason),
      { message: "Job status updated" },
    );
  },
);

export const verifyStartJob = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { otp } = req.body as { otp: string };
    const result = await partnerJobsService.verifyStart(sub, req.params.id, otp);
    sendSuccess(res, result, { message: "Job started successfully" });
  },
);

export const completePartnerJob = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { notes } = req.body as { notes?: string };
    const result = await partnerJobsService.completeJob(sub, req.params.id, notes);
    sendSuccess(res, result, { message: "Job completed successfully" });
  },
);

export const listExtraCharges = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const result = await partnerJobsService.listExtraCharges(sub, req.params.id);
    sendSuccess(res, result);
  },
);

export const createExtraCharge = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { description, quantity, amount, reason } = req.body as {
      description: string;
      quantity: number;
      amount: number;
      reason?: string;
    };
    const result = await partnerJobsService.createExtraCharge(sub, req.params.id, {
      description,
      quantity,
      amount,
      reason,
    });
    sendSuccess(res, result, { message: "Extra charge requested" });
  },
);

export const updateChecklistItem = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { done } = req.body as { done: boolean };
    const result = await partnerJobsService.updateChecklistItem(
      sub,
      req.params.id,
      req.params.itemId,
      done,
    );
    sendSuccess(res, result, { message: "Checklist updated" });
  },
);
