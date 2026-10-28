import { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { BookingService } from './bookings.service';
import type { ListBookingsQuery } from './bookings.query';
import type { CreateBookingInput } from './bookings.types';

/** The signed-in user's id, taken from the verified token. */
function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication token is missing');
  return id;
}

export const bookingsController = {
  async getSlots(req: Request, res: Response) {
    const result = await BookingService.getAvailableSlots(
      req.params.id,
      req.query.date as string,
    );
    res.json({ success: true, data: result });
  },

  async checkSlot(req: Request, res: Response) {
    const { serviceId, date, slot } = req.body as {
      serviceId: string;
      date: string;
      slot: string;
    };
    const result = await BookingService.checkSlotAvailability(serviceId, date, slot);
    res.status(200).json({
      success: true,
      message: 'Slot is available',
      data: result,
    });
  },

  async createBooking(req: Request, res: Response) {
    const idempotencyKey = req.header('Idempotency-Key');
    const result = await BookingService.createBooking(
      requireUserId(req),
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
    const booking = await BookingService.getBooking(requireUserId(req), req.params.id);
    res.json({ success: true, data: booking });
  },

  async getInvoice(req: Request, res: Response) {
    const { html, invoiceNo } = await BookingService.getInvoice(
      requireUserId(req),
      req.params.id,
    );
    res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${invoiceNo}.html"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(html);
  },

  async decideExtraCharge(req: Request, res: Response) {
    const { id, chargeId } = req.params;
    const { decision } = req.body as { decision: 'approve' | 'reject' };
    const booking = await BookingService.decideExtraCharge(
      requireUserId(req),
      id,
      chargeId,
      decision,
    );
    res.json({
      success: true,
      message: decision === 'approve' ? 'Extra charge approved' : 'Extra charge rejected',
      data: booking,
    });
  },

  async previewCancellation(req: Request, res: Response) {
    const result = await BookingService.previewCancellation(
      requireUserId(req),
      req.params.id,
    );
    res.json({ success: true, data: result });
  },

  async previewCancel(req: Request, res: Response) {
    return bookingsController.previewCancellation(req, res);
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
    const { date, slot } = req.body as { date: string; slot: string };
    const result = await BookingService.rescheduleBooking(
      requireUserId(req),
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
    const query = req.query as unknown as ListBookingsQuery;
    const { items, meta } = await BookingService.listBookings(requireUserId(req), query);
    res.json({ success: true, count: items.length, data: items, meta });
  },
};
