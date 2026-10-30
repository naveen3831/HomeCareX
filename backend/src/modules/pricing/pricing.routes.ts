import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { requireResourceAccess } from '../../middleware/permission.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';
import { pricingController } from './pricing.controller';
import { getPricingQuerySchema, putPricingBodySchema, quoteBodySchema } from './pricing.validation';
import { z } from 'zod';
import { ADMIN_ROLES } from '../../models/User';

export const pricingRoutes = Router();
export const adminPricingRoutes = Router();

// POST /pricing/quote: the price the customer will be charged for this exact order
pricingRoutes.post(
  '/quote',
  authMiddleware,
  roleMiddleware('customer', ...ADMIN_ROLES), // admins use this for the "Server quote" preview
  validationMiddleware({ body: quoteBodySchema }),
  asyncHandler(async (req, res) => pricingController.quote(req, res)),
);

// GET needs pricing:view; PUT / DELETE need pricing:manage (see actionFor in rbac.constants).
adminPricingRoutes.use(authMiddleware, roleMiddleware('admin'), requireResourceAccess('pricing'));
adminPricingRoutes.get(
  '/',
  validationMiddleware({ query: getPricingQuerySchema }),
  asyncHandler(async (req, res) => pricingController.listAdmin(req, res)),
);
adminPricingRoutes.put(
  '/',
  validationMiddleware({ body: putPricingBodySchema }),
  asyncHandler(async (req, res) => pricingController.saveAdmin(req, res)),
);
adminPricingRoutes.delete(
  '/:id',
  validationMiddleware({ params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) }) }),
  asyncHandler(async (req, res) => pricingController.deleteAdmin(req, res)),
);

export default pricingRoutes;