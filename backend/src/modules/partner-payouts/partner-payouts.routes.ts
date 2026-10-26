import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { getPayout,listPayouts } from './partner-payouts.controller';
import { payoutIdParamSchema, payoutsQuerySchema } from './partner-payouts.validation';

export const partnerPayoutsRoutes = Router();

// GET /api/v1/partner/payouts  ?status&limit   (role: partner, permission: partner:payouts:read)
partnerPayoutsRoutes.get(
  '/',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:payouts:read'),
  validate(payoutsQuerySchema, 'query'),
  listPayouts,
);

// GET /api/v1/partner/payouts/:id
partnerPayoutsRoutes.get(
  '/:id',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:payouts:read'),
  validate(payoutIdParamSchema, 'params'),
  getPayout,
);

export default partnerPayoutsRoutes;