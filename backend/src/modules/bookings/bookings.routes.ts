import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import { bookingsController } from "./bookings.controller";

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

// GET /services/:id/slots or /services/:serviceId/slots
bookingsRoutes.get(
  ['/services/:id/slots', '/services/:serviceId/slots'],
  (req, _res, next) => {
    if (!req.params.id) {
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
// Verify slot availability before creating a booking.
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
bookingsRoutes.get(
  '/bookings',
  authMiddleware,
  roleMiddleware('customer'),
  asyncHandler(async (req, res) => bookingsController.getSlots(req, res)),
  asyncHandler(async (req, res) =>
    bookingsController.getSlots(req, res),
  ),
);

// POST /bookings/check-slot
// Verify slot availability before creating a booking.
bookingsRoutes.post(
  "/bookings/check-slot",
  validationMiddleware({ body: checkSlotBodySchema }),
  asyncHandler(async (req, res) => bookingsController.checkSlot(req, res)),
  '/bookings/check-slot',
  validationMiddleware({
    body: checkSlotBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.checkSlot(req, res),
  ),
);

// POST /bookings
bookingsRoutes.post(
  "/bookings",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({ body: createBookingBodySchema }),
  asyncHandler(async (req, res) => bookingsController.createBooking(req, res)),
  roleMiddleware('customer'),
  validationMiddleware({
    body: createBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.createBooking(req, res),
  ),
);

// GET /bookings
bookingsRoutes.get(
  "/bookings",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({ query: listBookingsQuerySchema }),
  asyncHandler(async (req, res) => bookingsController.listBookings(req, res)),
  roleMiddleware('customer'),
  validationMiddleware({
    query: listBookingsQuerySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.listBookings(req, res),
  ),
);

// GET /bookings/:id
bookingsRoutes.get(
  "/bookings/:id",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getBooking(req, res)),
  roleMiddleware('customer'),
  validationMiddleware({
    params: getBookingParamsSchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.getBooking(req, res),
  ),
);

// GET /bookings/:id/invoice
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

// GET cancellation preview using supported URL aliases
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
bookingsRoutes.post(
  '/bookings/:id/cancel',
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
bookingsRoutes.get(
  '/bookings/:id',
    bookingsController.cancelBooking(req, res),
  ),
);

// POST /bookings/:id/reschedule
bookingsRoutes.post(
  '/bookings/:id/reschedule',
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

// GET cancellation preview using supported URL aliases
bookingsRoutes.get(
  [
    '/bookings/:id/cancel-preview',
    '/bookings/:id/preview-cancellation',
    '/bookings/:id/cancel-quote',
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
// POST /bookings/:id/extra-charges/:chargeId/decision
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

// Backward-compatible PATCH form for extra-charge decisions.
bookingsRoutes.patch(
  '/bookings/:id/extra-charges/:chargeId',
  authMiddleware,
  roleMiddleware('customer'),
// GET /bookings/:id/invoice — HTML invoice for own, paid booking (404 for someone else's, 409 until paid)
bookingsRoutes.get(
  "/bookings/:id/invoice",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.getInvoice(req, res)),
);

// POST /bookings/:id/extra-charges/:chargeId/decision — approve or reject one pending extra charge (own booking only)
bookingsRoutes.post(
  "/bookings/:id/extra-charges/:chargeId/decision",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({
    params: extraChargeDecisionParamsSchema,
    body: extraChargeDecisionBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.cancelBooking(req, res),
  ),
);

// POST /bookings/:id/reschedule
    bookingsController.decideExtraCharge(req, res),
  ),
);

export default bookingsRoutes;
// GET /bookings/:id/cancel-preview — the exact fee and refund if the customer cancelled right now
bookingsRoutes.get(
  "/bookings/:id/cancel-preview",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({ params: getBookingParamsSchema }),
  asyncHandler(async (req, res) => bookingsController.previewCancel(req, res)),
);

// POST /bookings/:id/cancel — cancel own booking: policy fee, refund request, reason (409 once in_progress)
bookingsRoutes.post(
  "/bookings/:id/cancel",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: cancelBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.rescheduleBooking(req, res),
  ),
);

// POST /bookings/:id/extra-charges/:chargeId/decision
  asyncHandler(async (req, res) => bookingsController.cancelBooking(req, res)),
);

// POST /bookings/:id/reschedule — move own booking to another slot (slot re-checked under a lock; 409 if taken)
bookingsRoutes.post(
  "/bookings/:id/reschedule",
  authMiddleware,
  roleMiddleware("customer"),
  validationMiddleware({
    params: getBookingParamsSchema,
    body: rescheduleBookingBodySchema,
  }),
  asyncHandler(async (req, res) =>
    bookingsController.decideExtraCharge(req, res),
    bookingsController.rescheduleBooking(req, res),
  ),
);

export default bookingsRoutes;
