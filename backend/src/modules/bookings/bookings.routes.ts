
import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';

import { bookingsController } from './bookings.controller';

import {
  createBookingBodySchema,
  getBookingParamsSchema,
  extraChargeDecisionParamsSchema,
  extraChargeDecisionBodySchema,
  getSlotsParamsSchema,
  getSlotsQuerySchema,
  checkSlotBodySchema,
  cancelBookingBodySchema,
  rescheduleBookingBodySchema,
} from './bookings.validation';

import { listBookingsQuerySchema } from './bookings.query';

export const bookingsRoutes = Router();

// GET /services/:id/slots?date=YYYY-MM-DD
// Supports both :id and :serviceId route parameter names.
bookingsRoutes.get(
  ['/services/:id/slots', '/services/:serviceId/slots'],
  (req, _res, next) => {
    if (!req.params.id && req.params.serviceId) {
      req.params.id = req.params.serviceId;
    }

    next();
  },
  validationMiddleware({
    params: getSlotsParamsSchema,
    query: getSlotsQuerySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.getSlots(req, res),
  ),
);

// POST /bookings/check-slot
// Real-time slot verification before booking.
bookingsRoutes.post(
  '/bookings/check-slot',
  validationMiddleware({
    body: checkSlotBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.checkSlot(req, res),
  ),
);

// POST /bookings
// Create a booking for the authenticated customer.
bookingsRoutes.post(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    body: createBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.createBooking(req, res),
  ),
);

// GET /bookings
// List the authenticated customer's bookings with pagination and filters.
bookingsRoutes.get(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    query: listBookingsQuerySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.listBookings(req, res),
  ),
);

// GET /bookings/:id
// Retrieve a single booking belonging to the authenticated customer.
bookingsRoutes.get(
  '/bookings/:id',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.getBooking(req, res),
  ),
);

// GET /bookings/:id/invoice
// Printable HTML invoice for a booking.
bookingsRoutes.get(
  '/bookings/:id/invoice',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.getInvoice(req, res),
  ),
);

// GET cancellation preview.
// Keep aliases for backward compatibility with existing clients.
bookingsRoutes.get(
  [
    '/bookings/:id/cancel-preview',
    '/bookings/:id/preview-cancellation',
    '/bookings/:id/cancel-quote',
    '/bookings/:id/cancellation-preview',
  ],
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.previewCancellation(req, res),
  ),
);

// POST /bookings/:id/cancel
// Cancel a booking belonging to the authenticated customer.
bookingsRoutes.post(
  '/bookings/:id/cancel',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: cancelBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.cancelBooking(req, res),
  ),
);

// POST /bookings/:id/reschedule
// Reschedule a booking.
bookingsRoutes.post(
  '/bookings/:id/reschedule',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: rescheduleBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.rescheduleBooking(req, res),
  ),
);

// POST /bookings/:id/extra-charges/:chargeId/decision
// Approve or reject a pending extra charge.
bookingsRoutes.post(
  '/bookings/:id/extra-charges/:chargeId/decision',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: extraChargeDecisionParamsSchema,
    body: extraChargeDecisionBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.decideExtraCharge(req, res),
  ),
);

// PATCH /bookings/:id/extra-charges/:chargeId
// Backward-compatible extra-charge decision endpoint.
bookingsRoutes.patch(
  '/bookings/:id/extra-charges/:chargeId',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({
    params: extraChargeDecisionParamsSchema,
    body: extraChargeDecisionBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.decideExtraCharge(req, res),
  ),
);

export default bookingsRoutes;
