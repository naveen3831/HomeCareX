import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerJobsService } from './partner-jobs.service';
import type { StatusBody } from './partner-jobs.validation';

export const getPartnerJob = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerJobsService.getJob(sub, req.params.id));
});

export const listJobRequests = asyncHandler(async (_req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerJobsService.listRequests(sub));
});

export const acceptJobOffer = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  const result = await partnerJobsService.acceptOffer(sub, req.params.id);
  sendSuccess(res, result, { message: result.message });
});

export const rejectJobOffer = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  const result = await partnerJobsService.rejectOffer(sub, req.params.id);
  sendSuccess(res, result, { message: result.message });
});

export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  const { status, reason } = req.body as StatusBody;
  sendSuccess(res, await partnerJobsService.updateStatus(sub, req.params.id, status, reason), {
    message: 'Job status updated',
  });
});