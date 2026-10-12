import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeCancellation } from './bookings.cancel';

const policy = { windowHours: 4, feeAmount: 99 };
const now = new Date('2026-10-12T06:00:00Z');
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

test('cancelling well before the slot is free and refunds everything paid', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(10), now, paidAmount: 1416, policy });
  assert.equal(q.freeCancellation, true);
  assert.equal(q.fee, 0);
  assert.equal(q.refundAmount, 1416);
});

test('exactly at the window edge is still free', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(4), now, paidAmount: 500, policy });
  assert.equal(q.freeCancellation, true);
  assert.equal(q.fee, 0);
});

test('inside the window the flat fee is kept and the rest refunded', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(2), now, paidAmount: 1416, policy });
  assert.equal(q.freeCancellation, false);
  assert.equal(q.fee, 99);
  assert.equal(q.refundAmount, 1317);
});

test('the fee never exceeds what was paid', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(1), now, paidAmount: 60, policy });
  assert.equal(q.fee, 60);
  assert.equal(q.refundAmount, 0);
});

test('an unpaid booking has no fee to keep and nothing to refund', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(1), now, paidAmount: 0, policy });
  assert.equal(q.fee, 0);
  assert.equal(q.refundAmount, 0);
});

test('the policy values come from the settings passed in', () => {
  const q = computeCancellation({ slotStart: hoursFromNow(10), now, paidAmount: 1000, policy: { windowHours: 24, feeAmount: 150 } });
  assert.equal(q.freeCancellation, false);
  assert.equal(q.fee, 150);
});
