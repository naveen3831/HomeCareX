import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { partnerJobsService } from "./partner-jobs.service";
import type { StartMedia } from "./partner-jobs.proof";
import type {
  ChecklistBody,
  CollectPaymentBody,
  CompleteBody,
  ExtraChargeBody,
  RateCustomerBody,
  RejectBody,
  SosBody,
  StatusBody,
  VerifyStartBody,
} from "./partner-jobs.validation";

export const listPartnerJobs = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const raw = typeof req.query.scope === "string" ? req.query.scope : "live";
    const scope = raw === "completed" || raw === "cancelled" ? raw : "live";
    sendSuccess(res, await partnerJobsService.listLiveJobs(sub, scope));
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

export const raiseJobSos = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const body = req.body as SosBody;
    const result = await partnerJobsService.raiseSos(sub, req.params.id, body.coordinates);
    sendSuccess(res, result, { message: "SOS sent to the admin team" });
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
    const { reason } = (req.body ?? {}) as RejectBody;
    const result = await partnerJobsService.rejectOffer(sub, req.params.id, reason);
    sendSuccess(res, result, { message: result.message });
  },
);

export const verifyJobStart = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { otp } = req.body as VerifyStartBody;
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const media = [...(files.media ?? []), ...(files.photo ?? [])].map((f) => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
    }));
    sendSuccess(res, await partnerJobsService.verifyStart(sub, req.params.id, otp, new Date(), media), {
      message: "Job started",
    });
  },
);

export const completePartnerJob = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { notes } = (req.body ?? {}) as CompleteBody;
    sendSuccess(res, await partnerJobsService.completeJob(sub, req.params.id, notes), {
      message: "Job completed",
    });
  },
);

export const collectJobPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { method } = req.body as CollectPaymentBody;
    sendSuccess(res, await partnerJobsService.collectPayment(sub, req.params.id, method), {
      message: "Payment recorded",
    });
  },
);

export const rateJobCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { rating, comment } = req.body as RateCustomerBody;
    sendSuccess(res, await partnerJobsService.rateCustomer(sub, req.params.id, rating, comment), {
      message: "Thanks for rating the customer",
    });
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

export const updateJobChecklistItem = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const { done } = req.body as ChecklistBody;
    sendSuccess(res, await partnerJobsService.updateChecklistItem(sub, req.params.id, req.params.itemId, done));
  },
);

export const listJobExtraCharges = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    sendSuccess(res, await partnerJobsService.listExtraCharges(sub, req.params.id));
  },
);

export const createJobExtraCharge = asyncHandler(
  async (req: Request, res: Response) => {
    const { sub } = res.locals.auth as { sub: string };
    const body = req.body as ExtraChargeBody;
    const result = await partnerJobsService.createExtraCharge(sub, req.params.id, {
      description: (body.title ?? body.description) as string,
      quantity: body.quantity ?? 1,
      amount: body.amount,
      reason: body.reason,
    });
    sendSuccess(res, result, { message: "Sent to the customer for approval" });
  },
);
