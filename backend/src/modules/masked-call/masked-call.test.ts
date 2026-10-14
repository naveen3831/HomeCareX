import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { partnerJobsRepository: jobs } = require('../partner-jobs/partner-jobs.repository') as typeof import('../partner-jobs/partner-jobs.repository');
const { maskedCallRepository: users } = require('./masked-call.repository') as typeof import('./masked-call.repository');
const { setMaskedCallProvider, StubMaskedCallProvider } = require('./masked-call.provider') as typeof import('./masked-call.provider');
/* eslint-enable @typescript-eslint/no-require-imports */

type Booking = NonNullable<Awaited<ReturnType<typeof jobs.findBooking>>>;

const partnerUserId = new Types.ObjectId().toString();
const otherPartnerUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const otherPartnerId = new Types.ObjectId();
const bookingId = new Types.ObjectId();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

const CUSTOMER_PHONE = '+919876543210';
const PARTNER_PHONE = '+919123456789';

let booking: Booking;
let server: Server;
let base: string;
const call = (id: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/call`, { method: 'POST', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });

describe('masked call', () => {
  before(() => {
    setMaskedCallProvider(new StubMaskedCallProvider('+918000000000'));
    jobs.findPartnerByUserId = (async (id: string) =>
      id === partnerUserId ? { _id: partnerId } : id === otherPartnerUserId ? { _id: otherPartnerId } : null) as unknown as typeof jobs.findPartnerByUserId;
    jobs.findBooking = (async (id: string) => (id === bookingId.toString() ? booking : null)) as unknown as typeof jobs.findBooking;
    jobs.findCustomer = (async () => ({ name: 'Rahul', phone: CUSTOMER_PHONE })) as unknown as typeof jobs.findCustomer;
    users.findUserPhone = (async () => ({ phone: PARTNER_PHONE })) as unknown as typeof users.findUserPhone;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    booking = { _id: bookingId, customerId: new Types.ObjectId(), partnerId, status: 'en_route' } as unknown as Booking;
  });

  it('returns the proxy number and never a real phone number', async () => {
    const res = await call(bookingId.toString(), token('partner'));
    assert.equal(res.status, 201);
    const text = await res.text();
    const body = JSON.parse(text) as { data: { proxyNumber: string; expiresAt: string } };
    assert.equal(body.data.proxyNumber, '+918000000000');
    assert.ok(new Date(body.data.expiresAt).getTime() > Date.now());
    assert.ok(!text.includes(CUSTOMER_PHONE) && !text.includes(PARTNER_PHONE));
  });

  it('401 without token, 403 wrong role, 403 another partner\'s job, 404 unknown booking, 400 bad id', async () => {
    assert.equal((await call(bookingId.toString())).status, 401);
    assert.equal((await call(bookingId.toString(), token('customer'))).status, 403);
    assert.equal((await call(bookingId.toString(), token('partner', otherPartnerUserId))).status, 403);
    assert.equal((await call(new Types.ObjectId().toString(), token('partner'))).status, 404);
    assert.equal((await call('nope', token('partner'))).status, 400);
  });

  it('409 when the job is not active', async () => {
    booking.status = 'completed' as Booking['status'];
    assert.equal((await call(bookingId.toString(), token('partner'))).status, 409);
  });
});