
import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { BookingService } from './bookings.service';
import type { ListBookingsQuery } from './bookings.query';
import type { CreateBookingInput } from './bookings.types';

/**
 * Gets the signed-in user's ID from the verified authentication token.
 * Never trust a user ID supplied through the request body or query.
 */
function requireUserId(req: Request): string {
  const id = req.user?.id;

  if (!id) {
    throw new AppError(
      401,
      'UNAUTHENTICATED',
      'Authentication token is missing',
    );
  }

  return id;
}

export const bookingsController = {
  async getSlots(req: Request, res: Response) {
    const serviceId = req.params.id;
    const date = req.query.date as string;

    const result = await BookingService.getAvailableSlots(serviceId, date);

    res.json({
      success: true,
      data: result,
    });
  },

  async checkSlot(req: Request, res: Response) {
    const serviceId = (
      req.params.id ||
      req.body.serviceId ||
      req.query.serviceId
    ) as string;

    const date = (req.query.date || req.body.date) as string;
    const slot = (req.query.slot || req.body.slot) as string;

    const result = await BookingService.checkSlotAvailability(
      serviceId,
      date,
      slot,
    );

    res.status(200).json({
      success: true,
      message: 'Slot is available',
      data: result,
    });
  },

  async createBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const idempotencyKey = req.header('Idempotency-Key');

    const result = await BookingService.createBooking(
      customerId,
      req.body as CreateBookingInput,
      idempotencyKey,
    );

    res.status(result.replayed ? 200 : 201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: result.booking,
      replayed: result.replayed,
    });
  },

  async getBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);

    const booking = await BookingService.getBooking(customerId, req.params.id);

    res.json({
      success: true,
      data: booking,
    });
  },

  async getInvoice(req: Request, res: Response) {
    const customerId = requireUserId(req);

    const { html, invoiceNo } = await BookingService.getInvoice(
      customerId,
      req.params.id,
    );

    // Invoice content contains private customer and payment information.
    res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoiceNo}.html"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Invoice-Number': invoiceNo,
      })
      .send(html);
  },

  async decideExtraCharge(req: Request, res: Response) {
    const { id, chargeId } = req.params;

    const { decision } = req.body as {
      decision: 'approve' | 'reject';
    };

    const booking = await BookingService.decideExtraCharge(
      requireUserId(req),
      id,
      chargeId,
      decision,
    );

    res.json({
      success: true,
      message:
        decision === 'approve'
          ? 'Extra charge approved'
          : 'Extra charge rejected',
      data: booking,
    });
  },

  async previewCancellation(req: Request, res: Response) {
    const customerId = requireUserId(req);

    const result = await BookingService.previewCancellation(
      customerId,
      req.params.id,
    );

    res.json({
      success: true,
      data: result,
    });
  },

  /**
   * Backward-compatible alias for routes using previewCancel.
   */
  async previewCancel(req: Request, res: Response) {
    return this.previewCancellation(req, res);
  },

  async cancelBooking(req: Request, res: Response) {
    const { reason } = req.body as { reason: string };

    const result = await BookingService.cancelBooking(
      requireUserId(req),
      req.params.id,
      reason,
    );

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: result,
    });
  },

  async rescheduleBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);

    const { date, slot } = req.body as {
      date: string;
      slot: string;
    };

    const result = await BookingService.rescheduleBooking(
      customerId,
      req.params.id,
      { date, slot },
    );

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: result,
    });
  },

  async listBookings(req: Request, res: Response) {
    // The customer ID always comes from the verified authentication token.
    const customerId = requireUserId(req);

    // Validation middleware should supply parsed, defaulted query values.
    const query = req.query as unknown as ListBookingsQuery;

    const { items, meta } = await BookingService.listBookings(
      customerId,
      query,
    );

    res.json({
      success: true,
      count: items.length,
      data: items,
      meta,
    });
  },
};