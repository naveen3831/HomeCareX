import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { partnerPerformanceService } from './partner-performance.service';

const requestedPartnerId = (req: Request): string | undefined =>
  typeof req.query.partnerId === 'string' ? req.query.partnerId : undefined;

export const getPerformance = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerPerformanceService.getSummary(sub, requestedPartnerId(req)));
});

export const getPerformanceTrends = asyncHandler(async (req: Request, res: Response) => {
  const { sub } = res.locals.auth as { sub: string };
  sendSuccess(res, await partnerPerformanceService.getTrends(sub, requestedPartnerId(req)));
});