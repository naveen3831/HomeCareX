
import type { Request, Response } from 'express';

import { BookingService } from './bookings.service';
import type { CreateBookingInput } from './bookings.types';
import type { ListBookingsQuery } from './bookings.query';
import { AppError } from '../../utils/AppError';

/**
 * Get the authenticated user's ID from the verified token.
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

/**
 * Read a required route parameter.
 */
function requireParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Missing required parameter: ${name}`,
    );
  }

  return value.trim();
}

/**
 * Validate a required string input.
 */
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} is required`,
    );
  }

  return value.trim();
}

export const bookingsController = {
  async getSlots(req: Request, res: Response) {
    const serviceId = requireParam(req, 'id');
    const date = requireString(req.query.date, 'date');

    const result = await BookingService.getAvailableSlots(
      serviceId,
      date,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  },

  async checkSlot(req: Request, res: Response) {
    const serviceId = requireString(
      req.params.id || req.body?.serviceId || req.query.serviceId,
      'serviceId',
    );

    const date = requireString(
      req.query.date ?? req.body?.date,
      'date',
    );

    const slot = requireString(
      req.query.slot ?? req.body?.slot,
      'slot',
    );

    const result = await BookingService.checkSlotAvailability(
      serviceId,
      date,
      slot,
    );

    return res.status(200).json({
      success: true,
      message: 'Slot is available',
      data: result,
    });
  },

  async createBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const idempotencyKey =
      req.header('Idempotency-Key') || undefined;

    const result = await BookingService.createBooking(
      customerId,
      req.body as CreateBookingInput,
      idempotencyKey,
    );

    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: result.booking,
      replayed: result.replayed,
    });
  },

  async getBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');

    const booking = await BookingService.getBooking(
      customerId,
      bookingId,
    );

    return res.status(200).json({
      success: true,
      data: booking,
    });
  },

  async getInvoice(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');

    const result: unknown = await BookingService.getInvoice(
      customerId,
      bookingId,
    );

    let html: string;
    let invoiceNo: string;

    if (typeof result === 'string') {
      // Supports services that return the HTML directly.
      html = result;
      invoiceNo = `invoice-${bookingId}`;
    } else if (
      result !== null &&
      typeof result === 'object' &&
      'html' in result &&
      'invoiceNo' in result &&
      typeof result.html === 'string' &&
      typeof result.invoiceNo === 'string'
    ) {
      html = result.html;
      invoiceNo = result.invoiceNo;
    } else {
      throw new AppError(
        500,
        'INVALID_INVOICE_RESPONSE',
        'The invoice could not be generated',
      );
    }

    if (!html.trim() || !invoiceNo.trim()) {
      throw new AppError(
        500,
        'INVALID_INVOICE_RESPONSE',
        'The invoice could not be generated',
      );
    }

    const safeFilename = invoiceNo.replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );

    return res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition':
          `inline; filename="${safeFilename}.html"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Invoice-Number': invoiceNo,
      })
      .send(html);
  },

  async decideExtraCharge(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');
    const chargeId = requireParam(req, 'chargeId');

    const decision = req.body?.decision;

    if (decision !== 'approve' && decision !== 'reject') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'decision must be either approve or reject',
      );
    }

    const booking = await BookingService.decideExtraCharge(
      customerId,
      bookingId,
      chargeId,
      decision,
    );

    return res.status(200).json({
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
    const bookingId = requireParam(req, 'id');

    const result = await BookingService.previewCancellation(
      customerId,
      bookingId,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  },

  /**
   * Alias retained for existing routes that use previewCancel.
   */
  async previewCancel(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');

    const result = await BookingService.previewCancellation(
      customerId,
      bookingId,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  },

  async cancelBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');
    const reason = requireString(req.body?.reason, 'reason');

    const result = await BookingService.cancelBooking(
      customerId,
      bookingId,
      reason,
    );

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: result,
    });
  },

  async rescheduleBooking(req: Request, res: Response) {
    const customerId = requireUserId(req);
    const bookingId = requireParam(req, 'id');

    const date = requireString(req.body?.date, 'date');
    const slot = requireString(req.body?.slot, 'slot');

    const result = await BookingService.rescheduleBooking(
      customerId,
      bookingId,
      { date, slot },
    );

    return res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: result,
    });
  },

  async listBookings(req: Request, res: Response) {
    const customerId = requireUserId(req);

    // Query validation and coercion should be handled by middleware.
    const query = req.query as unknown as ListBookingsQuery;

    const { items, meta } = await BookingService.listBookings(
      customerId,
      query,
    );

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
      meta,
    });
  },
};
