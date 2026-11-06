import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireAdmin, requireRole } from '../../middleware/role.middleware';
import { noQuery, validate } from '../../middleware/validation.middleware';
import {
  addAccount,
  adminApprove,
  adminDetail,
  adminList,
  adminMarkPaid,
  adminReject,
  cancelWithdrawal,
  createWithdrawal,
  deleteAccount,
  listAccounts,
  listWithdrawals,
  setDefaultAccount,
} from './partner-withdrawals.controller';
import {
  addBankAccountSchema,
  adminListQuerySchema,
  createWithdrawalSchema,
  idParamSchema,
  paidSchema,
  rejectSchema,
} from './partner-withdrawals.validation';

/** Mounted at /api/v1/partner/bank-accounts */
export const partnerBankAccountsRoutes = Router();
partnerBankAccountsRoutes.use(authenticate, requireRole('partner'));
partnerBankAccountsRoutes.get('/', requirePermission('partner:wallet:read'), noQuery, listAccounts);
partnerBankAccountsRoutes.post('/', requirePermission('partner:wallet:withdraw'), validate(addBankAccountSchema), addAccount);
partnerBankAccountsRoutes.patch('/:id/default', requirePermission('partner:wallet:withdraw'), validate(idParamSchema, 'params'), setDefaultAccount);
partnerBankAccountsRoutes.delete('/:id', requirePermission('partner:wallet:withdraw'), validate(idParamSchema, 'params'), deleteAccount);

/** Mounted at /api/v1/partner/withdrawals */
export const partnerWithdrawalsRoutes = Router();
partnerWithdrawalsRoutes.use(authenticate, requireRole('partner'));
partnerWithdrawalsRoutes.get('/', requirePermission('partner:wallet:read'), noQuery, listWithdrawals);
partnerWithdrawalsRoutes.post('/', requirePermission('partner:wallet:withdraw'), validate(createWithdrawalSchema), createWithdrawal);
partnerWithdrawalsRoutes.post('/:id/cancel', requirePermission('partner:wallet:withdraw'), validate(idParamSchema, 'params'), cancelWithdrawal);

/** Mounted at /api/v1/admin/withdrawals. Reuses the existing payouts permissions. */
export const adminWithdrawalsRoutes = Router();
adminWithdrawalsRoutes.use(authenticate, requireAdmin);
adminWithdrawalsRoutes.get('/', requirePermission('payouts:view'), validate(adminListQuerySchema, 'query'), adminList);
adminWithdrawalsRoutes.get('/:id', requirePermission('payouts:approve'), validate(idParamSchema, 'params'), adminDetail);
adminWithdrawalsRoutes.post('/:id/approve', requirePermission('payouts:approve'), validate(idParamSchema, 'params'), adminApprove);
adminWithdrawalsRoutes.post('/:id/paid', requirePermission('payouts:approve'), validate(idParamSchema, 'params'), validate(paidSchema), adminMarkPaid);
adminWithdrawalsRoutes.post('/:id/reject', requirePermission('payouts:approve'), validate(idParamSchema, 'params'), validate(rejectSchema), adminReject);
