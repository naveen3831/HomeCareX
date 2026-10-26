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
bookingsRoutes.get(
  '/services/:id/slots',
  validationMiddleware({
    params: getSlotsParamsSchema,
    query: getSlotsQuerySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.getSlots(req, res),
  ),
);

// POST /bookings/check-slot
// Real-time slot verification before confirming a booking.
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

export default bookingsRoutes;
