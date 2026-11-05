import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { partnerJobsRepository: repo } = require('./partner-jobs.repository') as typeof import('./partner-jobs.repository');
/* eslint-enable @typescript-eslint/no-require-imports */

type Booking = NonNullable<Awaited<ReturnType<typeof repo.findBooking>>>;

const partnerUserId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const otherPartnerId = new Types.ObjectId();
const bookingId = new Types.ObjectId();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let booking: Booking;
const makeBooking = (status: Booking['status'], owner: Types.ObjectId | null = partnerId): Booking => ({
  _id: bookingId,
  customerId: new Types.ObjectId(),
  partnerId: owner,
  serviceId: new Types.ObjectId(),
  serviceName: 'AC Service',
  customerName: 'Rahul Kumar',
  quantity: 1,
  addOns: [],
  address: { line1: '12 MG Road', area: 'Madhapur', city: 'Hyderabad', pincode: '500081', location: { coordinates: [78.39, 17.44] } },
  date: '2026-10-08',
  slot: '10:00-12:00',
  scheduledAt: new Date('2026-10-08T04:30:00Z'),
  status,
  statusHistory: [],
  priceSnapshot: { currency: 'INR', lines: [{ kind: 'ADDON', name: 'Eco chemicals', quantity: 1, amount: 50 }] },
  priceBreakdown: { total: 599 },
  partnerEarning: 450,
  paymentStatus: 'PAID',
  instructions: 'Ring the bell twice',
});

let server: Server;
let base: string;
const get = (id: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const patch = (id: string, body: unknown, bearer?: string) =>
  fetch(`${base}/api/v1/bookings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const getRequests = (bearer?: string) =>
  fetch(`${base}/api/v1/partner/job-requests`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const postAccept = (id: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/accept`, {
    method: 'POST',
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
const postReject = (id: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/reject`, {
    method: 'POST',
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
const code = async (res: Response) => ((await res.json()) as { code: string }).code;

describe('partner jobs', () => {
  before(() => {
    repo.findPartnerByUserId = (async (userId: string) =>
      userId === partnerUserId ? { _id: partnerId } : userId === otherUserId ? { _id: otherPartnerId } : null) as unknown as typeof repo.findPartnerByUserId;
    repo.findBooking = (async (id: string) => (id === bookingId.toString() ? booking : null)) as unknown as typeof repo.findBooking;
    repo.findCustomer = (async () => ({ name: 'Rahul Kumar', phone: '+919876543210' })) as unknown as typeof repo.findCustomer;
    repo.findService = (async () => ({ durationMinutes: 90, inclusions: ['Filter cleaning', 'Gas check'], addOns: [] })) as unknown as typeof repo.findService;
    repo.findJobRequests = (async (pid: Types.ObjectId) => {
      if (pid.toString() === partnerId.toString()) {
        return [
          {
            ...booking,
            status: 'searching_for_partner',
            offers: [
              {
                partnerId,
                offeredAt: new Date(),
                expiresAt: new Date(Date.now() + 600_000),
                response: 'pending',
              },
            ],
          },
        ];
      }
      return [];
    }) as unknown as typeof repo.findJobRequests;
    repo.findAdminAssignedAwaitingAcceptance = (async () => []) as unknown as typeof repo.findAdminAssignedAwaitingAcceptance;
    repo.acceptOffer = (async (bid: string, pid: Types.ObjectId) => {
      if (bid === bookingId.toString() && pid.toString() === partnerId.toString()) {
        return 'ACCEPTED';
      }
      return 'NOT_FOUND';
    }) as unknown as typeof repo.acceptOffer;
    repo.rejectOffer = (async (bid: string, pid: Types.ObjectId) => {
      if (bid === bookingId.toString() && pid.toString() === partnerId.toString()) {
        return 'REJECTED';
      }
      return 'NOT_FOUND';
    }) as unknown as typeof repo.rejectOffer;
    // Mimics the atomic compare-and-set in Mongo.
    repo.transitionStatus = (async (_id, pid, from, to, entry) => {
      if (booking.partnerId?.toString() !== pid.toString() || booking.status !== from) return false;
      booking.status = to;
      booking.statusHistory.push(entry);
      return true;
    }) as typeof repo.transitionStatus;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    booking = makeBooking('assigned');
  });

  describe('GET /partner/jobs/:id', () => {
    it('200: full job with masked customer and no secrets', async () => {
      const res = await get(bookingId.toString(), token('partner'));
      assert.equal(res.status, 200);
      const { data } = (await res.json()) as { data: Record<string, unknown> };
      assert.deepEqual(data.customer, { name: 'Rahul K.', phone: '******3210' });
      assert.equal(data.instructions, 'Ring the bell twice');
      assert.deepEqual(data.actions, [{ status: 'en_route', label: 'On the way' }]);
      assert.equal(data.otpRequired, false);
      assert.deepEqual(data.addOns, [{ name: 'Eco chemicals', quantity: 1, amount: 50 }]);
      assert.equal((data.checklist as unknown[]).length, 2);
      const text = JSON.stringify(data);
      assert.ok(!text.includes('9876543210'));
      assert.ok(!text.includes('otpCodes'));
    });
    it('401: no token', async () => assert.equal((await get(bookingId.toString())).status, 401));
    it('403: customer role', async () => assert.equal((await get(bookingId.toString(), token('customer'))).status, 403));
    it('403 RESOURCE_FORBIDDEN: another partner\'s job', async () => {
      const res = await get(bookingId.toString(), token('partner', otherUserId));
      assert.equal(res.status, 403);
      assert.equal(await code(res), 'RESOURCE_FORBIDDEN');
    });
    it('404: unknown job', async () => assert.equal((await get(new Types.ObjectId().toString(), token('partner'))).status, 404));
    it('400: malformed id', async () => assert.equal((await get('abc', token('partner'))).status, 400));
  });

  describe('PATCH /bookings/:id/status', () => {
    it('200: assigned -> en_route -> arrived, history records the partner', async () => {
      const a = await patch(bookingId.toString(), { status: 'en_route' }, token('partner'));
      assert.equal(a.status, 200);
      const b = await patch(bookingId.toString(), { status: 'arrived' }, token('partner'));
      assert.equal(b.status, 200);
      const { data } = (await b.json()) as { data: { status: string; otpRequired: boolean; actions: unknown[]; statusHistory: Array<{ to: string; actorRole: string; actorId: string }> } };
      assert.equal(data.status, 'arrived');
      assert.equal(data.otpRequired, true);
      assert.deepEqual(data.actions, []);
      assert.deepEqual(data.statusHistory.map((h) => h.to), ['en_route', 'arrived']);
      assert.equal(data.statusHistory[0].actorRole, 'partner');
      assert.equal(data.statusHistory[0].actorId, partnerUserId);
    });
    it('422: skipping a step (assigned -> arrived)', async () => {
      const res = await patch(bookingId.toString(), { status: 'arrived' }, token('partner'));
      assert.equal(res.status, 422);
      assert.equal(await code(res), 'INVALID_STATE_TRANSITION');
    });
    it('422: duplicate action is blocked', async () => {
      assert.equal((await patch(bookingId.toString(), { status: 'en_route' }, token('partner'))).status, 200);
      assert.equal((await patch(bookingId.toString(), { status: 'en_route' }, token('partner'))).status, 422);
    });
    it('422: cannot start before OTP', async () => {
      booking = makeBooking('arrived');
      const res = await patch(bookingId.toString(), { status: 'in_progress' }, token('partner'));
      assert.equal(res.status, 422);
      assert.equal(booking.status, 'arrived');
    });
    it('422: partner cannot complete or set unknown statuses', async () => {
      assert.equal((await patch(bookingId.toString(), { status: 'completed' }, token('partner'))).status, 422);
      assert.equal((await patch(bookingId.toString(), { status: 'banana' }, token('partner'))).status, 422);
    });
    it('400: missing status', async () => {
      const res = await patch(bookingId.toString(), {}, token('partner'));
      assert.equal(res.status, 400);
      assert.equal(await code(res), 'VALIDATION_ERROR');
    });
    it('401: no token', async () => assert.equal((await patch(bookingId.toString(), { status: 'en_route' })).status, 401));
    it('403: customer role', async () =>
      assert.equal((await patch(bookingId.toString(), { status: 'en_route' }, token('customer'))).status, 403));
    it('403: another partner\'s job is untouched', async () => {
      const res = await patch(bookingId.toString(), { status: 'en_route' }, token('partner', otherUserId));
      assert.equal(res.status, 403);
      assert.equal(booking.status, 'assigned');
    });
  });

  describe('GET /partner/job-requests', () => {
    it('200: returns available job requests for authenticated partner', async () => {
      const res = await getRequests(token('partner'));
      assert.equal(res.status, 200);
      const { data } = (await res.json()) as { data: Array<{ id: string; service: string; price: number }> };
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 1);
      assert.equal(data[0].id, bookingId.toString());
      assert.equal(data[0].service, 'AC Service');
    });
    it('401: rejects request without token', async () => {
      const res = await getRequests();
      assert.equal(res.status, 401);
    });
    it('403: rejects customer role', async () => {
      const res = await getRequests(token('customer'));
      assert.equal(res.status, 403);
    });
  });

  describe('POST /partner/jobs/:id/accept', () => {
    it('200: accepts job offer successfully', async () => {
      const res = await postAccept(bookingId.toString(), token('partner'));
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { success: boolean } };
      assert.equal(json.data.success, true);
    });
    it('404: unknown job cannot be accepted', async () => {
      const res = await postAccept(new Types.ObjectId().toString(), token('partner'));
      assert.equal(res.status, 404);
    });
    it('401: unauthenticated accept rejected', async () => {
      const res = await postAccept(bookingId.toString());
      assert.equal(res.status, 401);
    });
  });

  describe('POST /partner/jobs/:id/reject', () => {
    it('200: rejects job offer successfully', async () => {
      const res = await postReject(bookingId.toString(), token('partner'));
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { success: boolean } };
      assert.equal(json.data.success, true);
    });
    it('200: accepts a rejection reason and passes it to the repository', async () => {
      let seen: string | undefined;
      const original = repo.rejectOffer;
      repo.rejectOffer = (async (_bid: string, _pid: Types.ObjectId, reason?: string) => {
        seen = reason;
        return 'REJECTED';
      }) as unknown as typeof repo.rejectOffer;
      try {
        const res = await fetch(`${base}/api/v1/partner/jobs/${bookingId.toString()}/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token('partner')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '  Too far from my service area  ' }),
        });
        assert.equal(res.status, 200);
        assert.equal(seen, 'Too far from my service area');
      } finally {
        repo.rejectOffer = original;
      }
    });
    it('400: rejects a too-short reason', async () => {
      const res = await fetch(`${base}/api/v1/partner/jobs/${bookingId.toString()}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token('partner')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'x' }),
      });
      assert.equal(res.status, 400);
    });
    it('401: unauthenticated reject rejected', async () => {
      const res = await postReject(bookingId.toString());
      assert.equal(res.status, 401);
    });
  });

  describe('start, complete, payment and rating', () => {
    const post = (path: string, body: unknown, bearer = token('partner')) =>
      fetch(`${base}/api/v1/partner/jobs/${bookingId.toString()}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    type Detail = {
      status: string;
      payment: { status: string; method: string | null; amountDue: number; upiUri: string | null };
      customerRating: { rating: number; comment: string | null } | null;
    };
    const detail = async (res: Response) => ((await res.json()) as { data: Detail }).data;

    before(() => {
      repo.getStartOtp = (async () => '5127') as typeof repo.getStartOtp;
      repo.recordFailedStartAttempt = (async () => {
        booking.startOtpAttempts = (booking.startOtpAttempts ?? 0) + 1;
        return booking.startOtpAttempts;
      }) as typeof repo.recordFailedStartAttempt;
      // These mimic the atomic compare-and-set updates done in Mongo.
      repo.verifyStartJob = (async (_id, pid) => {
        if (booking.partnerId?.toString() !== pid.toString() || booking.status !== 'arrived') return false;
        booking.status = 'in_progress';
        return true;
      }) as typeof repo.verifyStartJob;
      repo.completePartnerJob = (async (_id, pid) => {
        if (booking.partnerId?.toString() !== pid.toString() || booking.status !== 'in_progress') return false;
        booking.status = 'completed';
        return true;
      }) as typeof repo.completePartnerJob;
      repo.markPaid = (async (_id, _pid, method, now) => {
        if (booking.paymentStatus === 'PAID') return false;
        booking.paymentStatus = 'PAID';
        booking.paymentDetails = { paidAt: now, method };
        return true;
      }) as typeof repo.markPaid;
      repo.saveCustomerRating = (async (_id, _pid, rating, comment, now) => {
        if (typeof booking.customerRating?.rating === 'number') return false;
        booking.customerRating = { rating, comment, ratedAt: now };
        return true;
      }) as typeof repo.saveCustomerRating;
    });

    it('200: arrived + correct start code moves the job to in_progress', async () => {
      booking = makeBooking('arrived');
      const res = await post('verify-start', { otp: '5127' });
      assert.equal(res.status, 200);
      assert.equal((await detail(res)).status, 'in_progress');
    });
    it('422: wrong start code, 400: malformed code, 422: not arrived yet', async () => {
      booking = makeBooking('arrived');
      assert.equal((await post('verify-start', { otp: '9999' })).status, 422);
      assert.equal((await post('verify-start', { otp: 'abc' })).status, 400);
      assert.equal(booking.status, 'arrived');
      booking = makeBooking('en_route');
      assert.equal((await post('verify-start', { otp: '5127' })).status, 422);
    });
    it('1234 is no longer a master code; 5 wrong tries lock the job (423)', async () => {
      booking = makeBooking('arrived');
      assert.equal((await post('verify-start', { otp: '1234' })).status, 422);
      for (let i = 0; i < 3; i++) await post('verify-start', { otp: '0000' });
      assert.equal((await post('verify-start', { otp: '0000' })).status, 423);
      assert.equal((await post('verify-start', { otp: '5127' })).status, 423);
      assert.equal(booking.status, 'arrived');
    });
    it('200: in_progress job can be completed, 422 otherwise', async () => {
      booking = makeBooking('in_progress');
      const res = await post('complete', {});
      assert.equal(res.status, 200);
      assert.equal((await detail(res)).status, 'completed');
      booking = makeBooking('assigned');
      assert.equal((await post('complete', {})).status, 422);
    });

    it('amountDue adds approved extra charges; upiUri only while unpaid and a UPI ID is set', async () => {
      process.env.UPI_PAYEE_ID = 'homecarex@upi';
      try {
        booking = { ...makeBooking('completed'), paymentStatus: 'PENDING' };
        booking.extraCharges = [
          { _id: new Types.ObjectId(), title: 'Extra', amount: 100, quantity: 2, status: 'approved', requestedAt: new Date() },
          { _id: new Types.ObjectId(), title: 'Skipped', amount: 500, quantity: 1, status: 'rejected', requestedAt: new Date() },
        ];
        const unpaid = await detail(await get(bookingId.toString(), token('partner')));
        assert.equal(unpaid.payment.amountDue, 799);
        assert.ok(unpaid.payment.upiUri?.startsWith('upi://pay?pa=homecarex%40upi'));
        assert.ok(unpaid.payment.upiUri?.includes('am=799.00'));
        booking.paymentStatus = 'PAID';
        assert.equal((await detail(await get(bookingId.toString(), token('partner')))).payment.upiUri, null);
        delete process.env.UPI_PAYEE_ID;
        booking.paymentStatus = 'PENDING';
        assert.equal((await detail(await get(bookingId.toString(), token('partner')))).payment.upiUri, null);
      } finally {
        delete process.env.UPI_PAYEE_ID;
      }
    });

    it('collect-payment: marks a completed job paid with the method, and is safe to repeat', async () => {
      booking = { ...makeBooking('completed'), paymentStatus: 'PENDING' };
      const res = await post('collect-payment', { method: 'cash' });
      assert.equal(res.status, 200);
      const d = await detail(res);
      assert.equal(d.payment.status, 'PAID');
      assert.equal(d.payment.method, 'cash');
      assert.equal((await post('collect-payment', { method: 'upi' })).status, 200);
      assert.equal(booking.paymentDetails?.method, 'cash');
    });
    it('collect-payment: 422 before completion, 400 for a bad method, 403 for another partner', async () => {
      booking = { ...makeBooking('in_progress'), paymentStatus: 'PENDING' };
      assert.equal((await post('collect-payment', { method: 'cash' })).status, 422);
      booking = { ...makeBooking('completed'), paymentStatus: 'PENDING' };
      assert.equal((await post('collect-payment', { method: 'card' })).status, 400);
      assert.equal((await post('collect-payment', { method: 'cash' }, token('partner', otherUserId))).status, 403);
      assert.equal(booking.paymentStatus, 'PENDING');
    });

    it('rate-customer: needs payment first, saves once, keeps the first rating', async () => {
      booking = { ...makeBooking('completed'), paymentStatus: 'PENDING' };
      assert.equal((await post('rate-customer', { rating: 5 })).status, 422);
      booking.paymentStatus = 'PAID';
      const res = await post('rate-customer', { rating: 4, comment: 'Polite and on time' });
      assert.equal(res.status, 200);
      assert.deepEqual((await detail(res)).customerRating, { rating: 4, comment: 'Polite and on time' });
      const again = await post('rate-customer', { rating: 1 });
      assert.equal(again.status, 200);
      assert.equal((await detail(again)).customerRating?.rating, 4);
    });
    it('rate-customer: 400 for out-of-range or missing rating, 401 without a token', async () => {
      booking = makeBooking('completed');
      assert.equal((await post('rate-customer', { rating: 6 })).status, 400);
      assert.equal((await post('rate-customer', { rating: 0 })).status, 400);
      assert.equal((await post('rate-customer', {})).status, 400);
      const res = await fetch(`${base}/api/v1/partner/jobs/${bookingId.toString()}/rate-customer`, { method: 'POST' });
      assert.equal(res.status, 401);
    });
  });
});