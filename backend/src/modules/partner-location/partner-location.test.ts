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
const { partnerLocationRepository: repo } = require('./partner-location.repository') as typeof import('./partner-location.repository');
const { locationNotifier } = require('./partner-location.service') as typeof import('./partner-location.service');
/* eslint-enable @typescript-eslint/no-require-imports */

type Booking = NonNullable<Awaited<ReturnType<typeof jobs.findBooking>>>;
type LocationDoc = import('./partner-location.repository').LocationDoc;
type LocationDto = import('./partner-location.service').LocationDto;

const partnerUserId = new Types.ObjectId().toString();
const otherPartnerUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const otherPartnerId = new Types.ObjectId();
const bookingId = new Types.ObjectId();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let booking: Booking;
let stored: LocationDoc | null;
let events: LocationDto[];
let server: Server;
let base: string;

const req = (method: string, id: string, bearer?: string, body?: unknown) =>
  fetch(`${base}/api/v1/partner/jobs/${id}/location`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const data = async (res: Response) => ((await res.json()) as { data: LocationDto }).data;

describe('partner location sharing', () => {
  before(() => {
    jobs.findPartnerByUserId = (async (id: string) =>
      id === partnerUserId ? { _id: partnerId } : id === otherPartnerUserId ? { _id: otherPartnerId } : null) as unknown as typeof jobs.findPartnerByUserId;
    jobs.findBooking = (async (id: string) => (id === bookingId.toString() ? booking : null)) as unknown as typeof jobs.findBooking;
    repo.find = (async () => stored) as unknown as typeof repo.find;
    repo.save = (async (bid, pid, fix) => {
      stored = { bookingId: bid, partnerId: pid, sharing: true, ...fix, updatedAt: new Date() };
      return stored;
    }) as typeof repo.save;
    repo.stop = (async () => {
      if (stored) stored.sharing = false;
      return stored;
    }) as unknown as typeof repo.stop;
    locationNotifier.update = (_id, dto) => void events.push(dto);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    booking = { _id: bookingId, customerId: new Types.ObjectId(), partnerId, status: 'en_route' } as unknown as Booking;
    stored = null;
    events = [];
  });

  it('stores a fix, reports sharing + last updated, and emits partner:location_update', async () => {
    const res = await req('PATCH', bookingId.toString(), token('partner'), { lat: 17.44, lng: 78.39, accuracy: 12 });
    assert.equal(res.status, 200);
    const dto = await data(res);
    assert.equal(dto.sharing, true);
    assert.equal(dto.lat, 17.44);
    assert.ok(dto.updatedAt);
    assert.equal(events.length, 1);

    const current = await data(await req('GET', bookingId.toString(), token('partner')));
    assert.equal(current.sharing, true);
    assert.equal(current.lng, 78.39);
  });

  it('GET before anything is shared returns a not-sharing state, not an error', async () => {
    const dto = await data(await req('GET', bookingId.toString(), token('partner')));
    assert.deepEqual([dto.sharing, dto.lat, dto.updatedAt], [false, null, null]);
  });

  it('stop sharing flips the flag, keeps the last fix, and notifies the room', async () => {
    await req('PATCH', bookingId.toString(), token('partner'), { lat: 17.44, lng: 78.39 });
    const dto = await data(await req('DELETE', bookingId.toString(), token('partner')));
    assert.equal(dto.sharing, false);
    assert.equal(dto.lat, 17.44);
    assert.equal(events.at(-1)?.sharing, false);
    // idempotent
    assert.equal((await req('DELETE', bookingId.toString(), token('partner'))).status, 200);
  });

  it('409 when the job is not active (e.g. completed, or not started yet)', async () => {
    booking.status = 'completed' as Booking['status'];
    assert.equal((await req('PATCH', bookingId.toString(), token('partner'), { lat: 1, lng: 1 })).status, 409);
    booking.status = 'assigned' as Booking['status'];
    assert.equal((await req('PATCH', bookingId.toString(), token('partner'), { lat: 1, lng: 1 })).status, 409);
    assert.equal(stored, null);
  });

  it('400 for missing or out-of-range coordinates', async () => {
    const t = token('partner');
    assert.equal((await req('PATCH', bookingId.toString(), t, { lat: 17.44 })).status, 400);
    assert.equal((await req('PATCH', bookingId.toString(), t, { lat: 91, lng: 0 })).status, 400);
    assert.equal((await req('PATCH', bookingId.toString(), t, { lat: 0, lng: 181 })).status, 400);
    assert.equal((await req('PATCH', bookingId.toString(), t, { lat: '17', lng: 78 })).status, 400);
    assert.equal(stored, null);
  });

  it('401 no token, 403 wrong role, 403 another partner\'s job, 404 unknown, 400 bad id', async () => {
    const body = { lat: 17.44, lng: 78.39 };
    assert.equal((await req('PATCH', bookingId.toString(), undefined, body)).status, 401);
    assert.equal((await req('PATCH', bookingId.toString(), token('customer'), body)).status, 403);
    assert.equal((await req('PATCH', bookingId.toString(), token('partner', otherPartnerUserId), body)).status, 403);
    assert.equal((await req('GET', bookingId.toString(), token('partner', otherPartnerUserId))).status, 403);
    assert.equal((await req('DELETE', bookingId.toString(), token('partner', otherPartnerUserId))).status, 403);
    assert.equal((await req('PATCH', new Types.ObjectId().toString(), token('partner'), body)).status, 404);
    assert.equal((await req('PATCH', 'nope', token('partner'), body)).status, 400);
    assert.equal(events.length, 0);
  });

  it('rate limits bursts (429)', async () => {
    const t = token('partner');
    let last = 200;
    for (let i = 0; i < 22; i++) last = (await req('PATCH', bookingId.toString(), t, { lat: 17.44, lng: 78.39 })).status;
    assert.equal(last, 429);
  });
});