import { notifyAdmins } from './notifications.service';
import type { NotificationType } from './notifications.constants';

/**
 * Admin bell alerts, one helper per event. Every helper is fire-and-forget: it never throws and never
 * rejects, so a failed alert can't fail the request that triggered it (the business action already happened).
 * The payload carries ids only; the admin UI builds the deep link from them (see adminNotificationMeta.ts).
 */
const send = (type: NotificationType, payload: Record<string, unknown>): void => {
  void notifyAdmins(type, payload).catch((err) => console.error(`[admin-alerts] ${type} failed`, err));
};

/** A partner (or customer) pressed SOS. Always delivered: it can't be switched off in Settings. */
export const alertSos = (i: { bookingId: string; partnerId?: string; partnerName?: string; coordinates?: { lat: number; lng: number } | null }): void =>
  send('sos.alert', {
    message: `SOS pressed${i.partnerName ? ` by ${i.partnerName}` : ' by a partner'} on an active job`,
    bookingId: i.bookingId,
    partnerId: i.partnerId,
    coordinates: i.coordinates ?? null,
  });

/** A partner submitted their KYC documents for review. Call where KYC status becomes `submitted`. */
export const alertKycSubmitted = (i: { partnerId: string; partnerName?: string }): void =>
  send('kyc.submitted', { message: `${i.partnerName ?? 'A partner'} submitted KYC for review`, partnerId: i.partnerId });

/** A partner finished all training steps and is waiting for an admin to approve it. */
export const alertTrainingCompleted = (i: { partnerId: string; partnerName?: string }): void =>
  send('training.completed', {
    message: `${i.partnerName ?? 'A partner'} completed the training and is waiting for your approval`,
    partnerId: i.partnerId,
  });

/** A refund was requested (e.g. a customer cancelled a paid booking). */
export const alertRefundRequested = (i: { refundId: string; bookingId?: string; amount?: number }): void =>
  send('refund.requested', {
    message: i.amount !== undefined ? `Refund of ₹${i.amount} requested` : 'Refund requested',
    refundId: i.refundId,
    bookingId: i.bookingId,
    amount: i.amount,
  });

/** A payout moved to `failed`. */
export const alertPayoutFailed = (i: { payoutId: string; amount?: number; partnerId?: string; partnerName?: string; batchId?: string }): void =>
  send('payout.failed', {
    message: `Payout${i.partnerName ? ` to ${i.partnerName}` : ''} failed${i.amount !== undefined ? ` (₹${i.amount})` : ''}`,
    payoutId: i.payoutId,
    partnerId: i.partnerId,
    batchId: i.batchId,
    amount: i.amount,
  });

const ticketRefOf = (id: string): string => `TCK-${id.slice(-6).toUpperCase()}`;

/** A customer or partner raised a new support ticket. */
export const alertTicketCreated = (i: { ticketId: string; subject?: string; role?: string }): void =>
  send('ticket.created', {
    message: `New ticket ${ticketRefOf(i.ticketId)}${i.subject ? `: ${i.subject}` : ''}${i.role ? ` (from a ${i.role})` : ''}`,
    ticketId: i.ticketId,
    ticketRef: ticketRefOf(i.ticketId),
    subject: i.subject,
  });

/** A customer or partner replied on an existing ticket. */
export const alertTicketReply = (i: { ticketId: string; subject?: string }): void =>
  send('ticket.reply', {
    message: `New reply on ${ticketRefOf(i.ticketId)}${i.subject ? `: ${i.subject}` : ''}`,
    ticketId: i.ticketId,
    ticketRef: ticketRefOf(i.ticketId),
  });

/** A support ticket went past its SLA target. */
export const alertSlaBreach = (i: { ticketId: string; ticketRef: string; priority: string }): void =>
  send('sla.breach', { message: `${i.ticketRef} breached its ${i.priority} SLA`, ticketId: i.ticketId, ticketRef: i.ticketRef, priority: i.priority });