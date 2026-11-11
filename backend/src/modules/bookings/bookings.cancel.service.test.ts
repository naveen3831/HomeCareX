import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { bookingsRepository } from './bookings.repository';
import { bookingSettings } from './bookings.settings';
import { BookingService } from './bookings.service';
import { addDays, nowInBookingTz } from './bookings.time';

/** Repository and settings are stubbed so these tests need no database. */
const repoOriginal = { ...bookingsRepository } as Record<string, unknown>;
const settingsOriginal = { ...bookingSettings } as Record<string, unknown>;
afterEach(() => {
  Object.assign(bookingsRepository, repoOriginal);
  Object.assign(bookingSettings, settingsOriginal);
});
const stub = (patch: Record<string, unknown>) => Object.assign(bookingsRepository, patch);
const stubSettings = (patch: Record<string, unknown>) => Object.assign(bookingSettings, patch);

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
const policy = { windowHours: 4, feeAmount: 99 };

const doc = (over: Record<string, unknown> = {}) => ({
  _id: 'b1',
  serviceId: 's1',
  status: 'confirmed',
  scheduledAt: hoursFromNow(10),
  date: addDays(nowInBookingTz().date, 2),
  slot: '10:00-12:00',
  extraCharges: [],
  statusHistory: [],
  ...over,
});
const payment = { _id: 'p1', amount: 1416, status: 'PAID' };

// ---------------------------------------------------------------- cancel

test("cancelling someone else's (or a missing) booking is a 404", async () => {
  stub({ findByIdForCustomer: async () => null });
  await assert.rejects(() => BookingService.cancelBooking('c1', 'b1', 'Plans changed'), {
    statusCode: 404,
    code: 'BOOKING_NOT_FOUND',
  });
  await assert.rejects(() => BookingService.previewCancellation('c1', 'b1'), { statusCode: 404 });
});

test('cancel after IN_PROGRESS is rejected by the state machine', async () => {
  let cancelled = false;
  stub({
    findByIdForCustomer: async () => doc({ status: 'in_progress' }),
    markCancelled: async () => {
      cancelled = true;
      return doc();
    },
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  await assert.rejects(() => BookingService.cancelBooking('c1', 'b1', 'Changed my mind'), {
    statusCode: 409,
    code: 'INVALID_STATE_TRANSITION',
  });
  await assert.rejects(() => BookingService.previewCancellation('c1', 'b1'), { statusCode: 409 });
  assert.equal(cancelled, false);
});

test('an already cancelled booking cannot be cancelled again', async () => {
  stub({ findByIdForCustomer: async () => doc({ status: 'cancelled_by_customer' }) });
  stubSettings({ getCancellationPolicy: async () => policy });
  await assert.rejects(() => BookingService.cancelBooking('c1', 'b1', 'Again'), { statusCode: 409 });
});

test('the preview shows the exact fee the cancel then charges (inside the window)', async () => {
  stub({
    findByIdForCustomer: async () => doc({ scheduledAt: hoursFromNow(2) }),
    findPaidPayment: async () => payment,
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  const preview = await BookingService.previewCancellation('c1', 'b1');
  assert.equal(preview.fee, 99);
  assert.equal(preview.refundAmount, 1317);
  assert.equal(preview.freeCancellation, false);
});

test('a free cancellation files a full refund request and writes the history entry', async () => {
  let history: { from: string; to: string; actorRole: string; reason?: string } | undefined;
  let refund: { amount: number; reason: string } | undefined;
  let calls = 0;
  stub({
    findByIdForCustomer: async () => {
      calls++;
      return calls === 1 ? doc() : doc({ status: 'cancelled_by_customer', cancellationReason: 'Plans changed' });
    },
    findPaidPayment: async () => payment,
    markCancelled: async (_b: string, _c: string, _from: string, entry: typeof history, _reason: string) => {
      history = entry;
      return doc({ status: 'cancelled_by_customer' });
    },
    createRefundRequest: async (args: { amount: number; reason: string }) => {
      refund = args;
      return {};
    },
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  const result = await BookingService.cancelBooking('c1', 'b1', 'Plans changed');

  assert.equal(history?.from, 'confirmed');
  assert.equal(history?.to, 'cancelled_by_customer');
  assert.equal(history?.actorRole, 'customer');
  assert.equal(history?.reason, 'Plans changed');
  assert.equal(refund?.amount, 1416);
  assert.equal(result.cancellation.fee, 0);
  assert.equal(result.cancellation.refundStatus, 'requested');
});

test('a late cancellation refunds the amount minus the fee', async () => {
  let refunded = 0;
  stub({
    findByIdForCustomer: async () => doc({ scheduledAt: hoursFromNow(1) }),
    findPaidPayment: async () => payment,
    markCancelled: async () => doc({ status: 'cancelled_by_customer' }),
    createRefundRequest: async (args: { amount: number }) => {
      refunded = args.amount;
      return {};
    },
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  const result = await BookingService.cancelBooking('c1', 'b1', 'Emergency');
  assert.equal(refunded, 1317);
  assert.equal(result.cancellation.fee, 99);
});

test('an unpaid booking cancels without any refund request', async () => {
  let refundCalls = 0;
  stub({
    findByIdForCustomer: async () => doc(),
    findPaidPayment: async () => null,
    markCancelled: async () => doc({ status: 'cancelled_by_customer' }),
    createRefundRequest: async () => {
      refundCalls++;
      return {};
    },
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  const result = await BookingService.cancelBooking('c1', 'b1', 'Not needed');
  assert.equal(refundCalls, 0);
  assert.equal(result.cancellation.refundStatus, 'none');
});

test('losing the race (booking changed under us) is a 409 and files no refund', async () => {
  let refundCalls = 0;
  stub({
    findByIdForCustomer: async () => doc(),
    findPaidPayment: async () => payment,
    markCancelled: async () => null,
    createRefundRequest: async () => {
      refundCalls++;
      return {};
    },
  });
  stubSettings({ getCancellationPolicy: async () => policy });
  await assert.rejects(() => BookingService.cancelBooking('c1', 'b1', 'Twice'), {
    statusCode: 409,
    code: 'INVALID_STATE_TRANSITION',
  });
  assert.equal(refundCalls, 0);
});

// ------------------------------------------------------------- reschedule

const tomorrow = () => addDays(nowInBookingTz().date, 1);

test("rescheduling someone else's booking is a 404", async () => {
  stub({ findByIdForCustomer: async () => null });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' }), {
    statusCode: 404,
  });
});

test('reschedule is refused once a partner is on the way or the job started', async () => {
  for (const status of ['assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled_by_customer']) {
    stub({ findByIdForCustomer: async () => doc({ status }) });
    await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' }), {
      statusCode: 409,
      code: 'INVALID_STATE_TRANSITION',
    });
  }
});

test('reschedule is allowed for an overdue/unassigned booking when no partner is assigned', async () => {
  const d = doc({
    partnerId: null,
    date: '2020-01-01',
    slot: '08:00-10:00',
    status: 'confirmed',
  });
  let args: any;
  let reads = 0;
  stub({
    findByIdForCustomer: async () => (++reads === 1 ? d : doc({ date: tomorrow(), slot: '12:00-14:00' })),
    releaseStaleHolds: async () => null,
    findFreeSeat: async () => 1,
    reschedule: async (a: any) => {
      args = a;
      return doc({ date: tomorrow(), slot: '12:00-14:00' });
    },
  });
  const view = await BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' });
  assert.equal(args?.to.slot, '12:00-14:00');
  assert.equal(view.slot, '12:00-14:00');
});

test('reschedule is refused if a partner has already been assigned', async () => {
  stub({ findByIdForCustomer: async () => doc({ partnerId: 'partner_123', status: 'confirmed' }) });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' }), {
    statusCode: 409,
    code: 'BOOKING_NOT_RESCHEDULABLE',
  });
});

test('picking the slot the booking already has is a 400', async () => {
  const d = doc();
  stub({ findByIdForCustomer: async () => d });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: d.date, slot: d.slot }), {
    statusCode: 400,
    code: 'SAME_SLOT',
  });
});

test('reschedule slot conflict: a full slot is a 409 and nothing is updated', async () => {
  let updated = false;
  stub({
    findByIdForCustomer: async () => doc(),
    releaseStaleHolds: async () => null,
    findFreeSeat: async () => null,
    reschedule: async () => {
      updated = true;
      return doc();
    },
  });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' }), {
    statusCode: 409,
    code: 'SLOT_UNAVAILABLE',
  });
  assert.equal(updated, false);
});

test('a successful reschedule re-checks the slot, moves the seat and writes a history entry', async () => {
  const d = doc();
  let args: { to: { date: string; slot: string; seat: number }; entry: { from: string; to: string; reason?: string } } | undefined;
  let freeSeatChecked = false;
  let reads = 0;
  stub({
    // First read is the booking as it was; the read after the update is the moved booking.
    findByIdForCustomer: async () => (++reads === 1 ? d : doc({ date: tomorrow(), slot: '12:00-14:00' })),
    releaseStaleHolds: async () => null,
    findFreeSeat: async () => {
      freeSeatChecked = true;
      return 2;
    },
    reschedule: async (a: typeof args) => {
      args = a;
      return doc({ date: tomorrow(), slot: '12:00-14:00' });
    },
  });
  const view = await BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' });
  assert.equal(freeSeatChecked, true);
  assert.equal(args?.to.seat, 2);
  assert.equal(args?.to.slot, '12:00-14:00');
  assert.equal(args?.entry.from, 'confirmed');
  assert.equal(args?.entry.to, 'confirmed');
  assert.match(args?.entry.reason ?? '', /Rescheduled from/);
  assert.equal(view.slot, '12:00-14:00');
});

test('a booking that changed during the reschedule is a 409', async () => {
  stub({
    findByIdForCustomer: async () => doc(),
    releaseStaleHolds: async () => null,
    findFreeSeat: async () => 1,
    reschedule: async () => null,
  });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: tomorrow(), slot: '12:00-14:00' }), {
    statusCode: 409,
    code: 'INVALID_STATE_TRANSITION',
  });
});

test('a past date is refused', async () => {
  stub({ findByIdForCustomer: async () => doc() });
  await assert.rejects(() => BookingService.rescheduleBooking('c1', 'b1', { date: '2020-01-01', slot: '12:00-14:00' }), {
    statusCode: 400,
    code: 'INVALID_DATE',
  });
});
