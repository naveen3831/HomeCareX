import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { adminWithdrawalsService, partnerWithdrawalsService } from './partner-withdrawals.service';
import type { AddBankAccountInput, AdminListQuery, CreateWithdrawalInput } from './partner-withdrawals.validation';

const userId = (res: Response): string => (res.locals.auth as { sub: string }).sub;
const id = (req: Request): string => String(req.params.id);

/* partner */
export const listAccounts = asyncHandler(async (_req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.listAccounts(userId(res)));
});
export const addAccount = asyncHandler(async (req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.addAccount(userId(res), req.body as AddBankAccountInput), { status: 201 });
});
export const setDefaultAccount = asyncHandler(async (req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.setDefaultAccount(userId(res), id(req)));
});
export const deleteAccount = asyncHandler(async (req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.deleteAccount(userId(res), id(req)));
});
export const listWithdrawals = asyncHandler(async (_req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.list(userId(res)));
});
export const createWithdrawal = asyncHandler(async (req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.create(userId(res), req.body as CreateWithdrawalInput), {
    status: 201,
    message: 'Withdrawal requested. We will review it shortly.',
  });
});
export const cancelWithdrawal = asyncHandler(async (req, res) => {
  sendSuccess(res, await partnerWithdrawalsService.cancel(userId(res), id(req)));
});

/* admin */
export const adminList = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminWithdrawalsService.list(req.query as unknown as AdminListQuery));
});
export const adminDetail = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminWithdrawalsService.detail(id(req)));
});
export const adminApprove = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminWithdrawalsService.approve(userId(res), id(req)));
});
export const adminMarkPaid = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminWithdrawalsService.markPaid(userId(res), id(req), (req.body as { transactionId: string }).transactionId));
});
export const adminReject = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminWithdrawalsService.reject(userId(res), id(req), (req.body as { reason: string }).reason));
});