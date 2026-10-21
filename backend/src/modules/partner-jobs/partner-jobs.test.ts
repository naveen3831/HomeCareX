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
const postVerifyStart = (id: string, body: unknown, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/verify-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const postComplete = (id: string, body: unknown, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const getExtraCharges = (id: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/extra-charges`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
const postExtraCharge = (id: string, body: unknown, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/extra-charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const patchChecklist = (id: string, itemId: string, body: unknown, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/checklist/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
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
    repo.verifyStartJob = (async (_bid: any, pid: any, entry: any) => {
      if (booking.partnerId?.toString() !== pid.toString() || booking.status !== 'arrived') return false;
      booking.status = 'in_progress';
      booking.statusHistory.push(entry);
      return true;
    }) as unknown as typeof repo.verifyStartJob;
    repo.completePartnerJob = (async (_bid: any, pid: any, entry: any) => {
      if (booking.partnerId?.toString() !== pid.toString() || booking.status !== 'in_progress') return false;
      booking.status = 'completed';
      booking.statusHistory.push(entry);
      return true;
    }) as unknown as typeof repo.completePartnerJob;
    repo.addExtraCharge = (async (_bid: any, pid: any, charge: any) => {
      if (booking.partnerId?.toString() !== pid.toString()) return false;
      if (!booking.extraCharges) booking.extraCharges = [];
      booking.extraCharges.push(charge);
      return true;
    }) as unknown as typeof repo.addExtraCharge;
    repo.updateChecklist = (async (_bid: any, pid: any, checklist: any) => {
      if (booking.partnerId?.toString() !== pid.toString()) return false;
      booking.checklist = checklist;
      return true;
    }) as unknown as typeof repo.updateChecklist;
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
    it('401: unauthenticated reject rejected', async () => {
      const res = await postReject(bookingId.toString());
      assert.equal(res.status, 401);
    });
  });

  describe('POST /partner/jobs/:id/verify-start', () => {
    it('200: starts job when arrived and OTP is valid', async () => {
      booking.status = 'arrived';
      const res = await postVerifyStart(bookingId.toString(), { otp: '1234' }, token('partner'));
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { status: string } };
      assert.equal(json.data.status, 'in_progress');
    });

    it('422: rejects start when OTP is invalid', async () => {
      booking.status = 'arrived';
      const res = await postVerifyStart(bookingId.toString(), { otp: '9999' }, token('partner'));
      assert.equal(res.status, 422);
      assert.equal(await code(res), 'INVALID_OTP');
    });

    it('422: rejects start when status is not arrived', async () => {
      booking.status = 'assigned';
      const res = await postVerifyStart(bookingId.toString(), { otp: '1234' }, token('partner'));
      assert.equal(res.status, 422);
    });
  });

  describe('POST /partner/jobs/:id/complete', () => {
    it('200: completes job when in_progress', async () => {
      booking.status = 'in_progress';
      booking.extraCharges = [];
      const res = await postComplete(bookingId.toString(), { notes: 'All done' }, token('partner'));
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { status: string } };
      assert.equal(json.data.status, 'completed');
    });

    it('422: rejects complete when status is not in_progress', async () => {
      booking.status = 'assigned';
      const res = await postComplete(bookingId.toString(), {}, token('partner'));
      assert.equal(res.status, 422);
    });
  });

  describe('GET & POST /partner/jobs/:id/extra-charges', () => {
    it('200: creates and lists extra charges', async () => {
      booking.status = 'in_progress';
      const createRes = await postExtraCharge(
        bookingId.toString(),
        { description: 'Extra wire', quantity: 2, amount: 250, reason: 'Wiring work' },
        token('partner'),
      );
      assert.equal(createRes.status, 200);
      const createJson = (await createRes.json()) as { success: boolean; data: { title: string; amount: number } };
      assert.equal(createJson.data.title, 'Extra wire');
      assert.equal(createJson.data.amount, 250);

      const listRes = await getExtraCharges(bookingId.toString(), token('partner'));
      assert.equal(listRes.status, 200);
      const listJson = (await listRes.json()) as { success: boolean; data: Array<{ title: string }> };
      assert.ok(listJson.data.some((c) => c.title === 'Extra wire'));
    });
  });

  describe('PATCH /partner/jobs/:id/checklist/:itemId', () => {
    it('200: updates checklist item status', async () => {
      booking.status = 'in_progress';
      booking.checklist = [{ id: 'chk-1', label: 'Filter cleaning', done: false }];
      const res = await patchChecklist(bookingId.toString(), 'chk-1', { done: true }, token('partner'));
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { checklist: Array<{ done: boolean }> } };
      assert.equal(json.data.checklist[0].done, true);
    });
  });
});