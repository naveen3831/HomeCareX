import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { listBookingsQuerySchema } from './bookings.query';
import { bookingsController } from './bookings.controller';
import {
  cancelBookingBodySchema,
  checkSlotBodySchema,
  createBookingBodySchema,
  extraChargeDecisionBodySchema,
  extraChargeDecisionParamsSchema,
  getBookingParamsSchema,
  getSlotsParamsSchema,
  getSlotsQuerySchema,
  rescheduleBookingBodySchema,
} from './bookings.validation';

export const bookingsRoutes = Router();

bookingsRoutes.get(
  '/services/:id/slots',
  validationMiddleware({
    params: getSlotsParamsSchema,
    query: getSlotsQuerySchema,
  }),
  asyncHandler(async (req, res) => bookingsController.getSlots(req, res)),
);

bookingsRoutes.post(
  '/bookings/check-slot',
  validationMiddleware({ body: checkSlotBodySchema }),
  asyncHandler(async (req, res) => bookingsController.checkSlot(req, res)),
);

bookingsRoutes.post(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ body: createBookingBodySchema }),
  asyncHandler(async (req, res) => bookingsController.createBooking(req, res)),
);

bookingsRoutes.get(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ query: listBookingsQuerySchema }),
  asyncHandler(async (req, res) => bookingsController.listBookings(req, res)),
);

bookingsRoutes.get(
  '/bookings/:id/invoice',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getInvoice(req, res)),
);

bookingsRoutes.get(
  '/bookings/:id/cancel-preview',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.previewCancellation(req, res)),
);

bookingsRoutes.post(
  '/bookings/:id/cancel',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: cancelBookingBodySchema,
  }),
  asyncHandler(async (req, res) => bookingsController.cancelBooking(req, res)),
);

bookingsRoutes.post(
  '/bookings/:id/reschedule',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: rescheduleBookingBodySchema,
  }),
  asyncHandler(async (req, res) => bookingsController.rescheduleBooking(req, res)),
);

bookingsRoutes.post(
  '/bookings/:id/extra-charges/:chargeId/decision',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: extraChargeDecisionParamsSchema,
    body: extraChargeDecisionBodySchema,
  }),
  asyncHandler(async (req, res) => bookingsController.decideExtraCharge(req, res)),
);

bookingsRoutes.get(
  '/bookings/:id',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getBooking(req, res)),
);

export default bookingsRoutes;
