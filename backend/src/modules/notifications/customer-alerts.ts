import { notify } from './notifications.service';
import type { NotificationType } from './notifications.constants';

/**
 * Customer bell alerts, one helper per event. Same rule as admin-alerts.ts: fire-and-forget. A helper never
 * throws and never rejects, so a failed notification can't fail the booking / job action that triggered it.
 * Payloads carry ids and a short message only (never OTP codes or other secrets).
 */
const send = (customerId: unknown, type: NotificationType, payload: Record<string, unknown>): void => {
  if (!customerId) return;
  void notify(String(customerId), type, payload).catch((err) => console.error(`[customer-alerts] ${type} failed`, err));
};

/** Booking was created (may still be waiting for payment). */
export const alertCustomerBookingCreated = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.created', { message: 'Your booking has been created', bookingId: i.bookingId });

/** Payment captured and the booking is now confirmed. */
export const alertCustomerPaymentSucceeded = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'payment.succeeded', { message: 'Payment received. Your booking is confirmed', bookingId: i.bookingId });

/** A partner accepted the job. */
export const alertCustomerPartnerAssigned = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.assigned', { message: 'A partner has been assigned to your booking', bookingId: i.bookingId });

/** Partner is on the way. */
export const alertCustomerPartnerEnRoute = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.started', { message: 'Your partner is on the way', bookingId: i.bookingId, stage: 'en_route' });

/** Partner arrived: the customer must give the start code (OTP) shown in the booking. The code itself is NOT sent here. */
export const alertCustomerPartnerArrived = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.partner_arrived', {
    message: 'Your partner has arrived. Share the start code from your booking to begin the service',
    bookingId: i.bookingId,
  });

/** Start code verified and the job is in progress. */
export const alertCustomerJobStarted = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.started', { message: 'Your service has started', bookingId: i.bookingId, stage: 'in_progress' });

/** Job finished: invite the customer to rate it. */
export const alertCustomerJobCompleted = (i: { customerId: unknown; bookingId: string }): void =>
  send(i.customerId, 'booking.completed', { message: 'Your service is complete. Please rate your experience', bookingId: i.bookingId });

/** Customer cancelled their own booking (confirmation for the customer). */
export const alertCustomerBookingCancelled = (i: { customerId: unknown; bookingId: string; refundAmount?: number }): void =>
  send(i.customerId, 'booking.cancelled', {
    message: i.refundAmount && i.refundAmount > 0 ? `Your booking was cancelled. Refund of ₹${i.refundAmount} requested` : 'Your booking was cancelled',
    bookingId: i.bookingId,
  });

/** Customer moved the booking to a new date / slot. */
export const alertCustomerBookingRescheduled = (i: { customerId: unknown; bookingId: string; date: string; slot: string }): void =>
  send(i.customerId, 'booking.rescheduled', { message: `Your booking was rescheduled to ${i.date} (${i.slot})`, bookingId: i.bookingId });
