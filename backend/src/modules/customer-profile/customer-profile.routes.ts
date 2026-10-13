import express, { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';
import { customerProfileController } from './customer-profile.controller';
import { updatePreferencesBodySchema, updateProfileBodySchema } from './customer-profile.validation';
import { AVATAR_MAX_BYTES } from './customer-profile.constants';

/** GET/PATCH /customer/profile, POST/DELETE /customer/profile/avatar. Customers only; the user comes from the token. */
export const customerProfileRoutes = Router();
customerProfileRoutes.use(authMiddleware, roleMiddleware('customer'));

customerProfileRoutes.get('/', asyncHandler(async (req, res) => customerProfileController.get(req, res)));
customerProfileRoutes.patch(
  '/',
  validationMiddleware({ body: updateProfileBodySchema }),
  asyncHandler(async (req, res) => customerProfileController.update(req, res)),
);

// The image is sent as the raw request body (Content-Type: image/jpeg | png | webp). Using express.raw keeps
// this free of extra dependencies; the limit is one byte over 2 MB so an oversized file gets a clear 413.
customerProfileRoutes.post(
  '/avatar',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: AVATAR_MAX_BYTES + 1 }),
  asyncHandler(async (req, res) => customerProfileController.uploadAvatar(req, res)),
);
customerProfileRoutes.delete('/avatar', asyncHandler(async (req, res) => customerProfileController.removeAvatar(req, res)));

/** GET/PATCH /customer/preferences (notification matrix + language). */
export const customerPreferencesRoutes = Router();
customerPreferencesRoutes.use(authMiddleware, roleMiddleware('customer'));
customerPreferencesRoutes.get('/', asyncHandler(async (req, res) => customerProfileController.getPreferences(req, res)));
customerPreferencesRoutes.patch(
  '/',
  validationMiddleware({ body: updatePreferencesBodySchema }),
  asyncHandler(async (req, res) => customerProfileController.updatePreferences(req, res)),
);
