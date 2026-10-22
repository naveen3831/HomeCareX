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
  validationMiddleware({ params: getSlotsParamsSchema, query: getSlotsQuerySchema }),
  asyncHandler(async (req, res) => bookingsController.getSlots(req, res))
);

// POST /bookings/check-slot — Real-time slot verification when clicking "Next Step"
bookingsRoutes.post(
  '/bookings/check-slot',
  validationMiddleware({ body: checkSlotBodySchema }),
  asyncHandler(async (req, res) => bookingsController.checkSlot(req, res))
);

// POST /bookings — Pay & Confirm (returns 201 Created or 409 Conflict if slot was taken)
bookingsRoutes.post(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ body: createBookingBodySchema }),
  asyncHandler(async (req, res) => bookingsController.createBooking(req, res))
);

// GET /bookings?status&search&date&service&page&limit&sort — the signed-in customer's bookings, one page at a time
bookingsRoutes.get(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ query: listBookingsQuerySchema }),
  asyncHandler(async (req, res) => bookingsController.listBookings(req, res))
);

// GET /bookings/:id — Get details of a single booking
bookingsRoutes.get(
  '/bookings/:id',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getBooking(req, res))
);

// GET /bookings/:id/invoice — Printable HTML invoice for paid bookings
bookingsRoutes.get(
  '/bookings/:id/invoice',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getInvoice(req, res))
);

// GET /bookings/:id/cancel-preview — Fee and refund quote for cancellation
bookingsRoutes.get(
  '/bookings/:id/cancel-preview',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.previewCancellation(req, res))
);

// POST /bookings/:id/cancel — Cancel booking
bookingsRoutes.post(
  '/bookings/:id/cancel',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema, body: cancelBookingBodySchema }),
  asyncHandler(async (req, res) => bookingsController.cancelBooking(req, res))
);

// POST /bookings/:id/reschedule — Reschedule booking
bookingsRoutes.post(
  '/bookings/:id/reschedule',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: getBookingParamsSchema, body: rescheduleBookingBodySchema }),
  asyncHandler(async (req, res) => bookingsController.rescheduleBooking(req, res))
);

// POST /bookings/:id/extra-charges/:chargeId/decision — approve or reject one pending extra charge (own booking only)
bookingsRoutes.post(
  '/bookings/:id/extra-charges/:chargeId/decision',
  authMiddleware,
  roleMiddleware('customer'),
  validationMiddleware({ params: extraChargeDecisionParamsSchema, body: extraChargeDecisionBodySchema }),
  asyncHandler(async (req, res) => bookingsController.decideExtraCharge(req, res))
);


export default bookingsRoutes;