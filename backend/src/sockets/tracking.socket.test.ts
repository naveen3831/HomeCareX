import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import http, { type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as connect, type Socket } from 'socket.io-client';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const { initSockets } = require('./index') as typeof import('./index');
const { trackingService } = require('../services/TrackingService') as typeof import('../services/TrackingService');
const BookingModel = (require('../models/Booking') as typeof import('../models/Booking')).default;
const PartnerLocationModel = (require('../models/PartnerLocation') as typeof import('../models/PartnerLocation')).default;
/* eslint-enable @typescript-eslint/no-require-imports */

const customerUser = new Types.ObjectId().toString();
const strangerUser = new Types.ObjectId().toString();
const partnerUser = new Types.ObjectId().toString();
const adminUser = new Types.ObjectId().toString();
const myBooking = new Types.ObjectId().toString();
const missingBooking = new Types.ObjectId().toString();
const updatedAt = new Date('2026-10-13T10:00:00.000Z');

const tok = (role: string, sub: string) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let httpServer: HttpServer;
let url: string;
let storedLocation: Record<string, unknown> | null = null;
const open: Socket[] = [];

const connectAs = (role: string, sub: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = connect(url, { auth: { token: tok(role, sub) }, transports: ['websocket'], reconnection: false, forceNew: true });
    open.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });

type Ack = { ok: boolean; code?: string; snapshot?: { status: string; partnerAssigned: boolean; location: Record<string, unknown> } };
const join = (s: Socket, bookingId: unknown) => new Promise<Ack>((resolve) => s.emit('tracking:join', { bookingId }, resolve));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Customer tracking room (tracking:join)', () => {
  before(async () => {
    // Stub the DB: myBooking belongs to customerUser, has a partner and is en_route.
    (BookingModel as unknown as { exists: unknown }).exists = async (q: { _id: string; customerId?: string }) =>
      q._id === myBooking && q.customerId === customerUser ? { _id: myBooking } : null;
    (BookingModel as unknown as { findById: unknown }).findById = (id: string) => ({
      select: () => ({ lean: async () => (id === myBooking ? { status: 'en_route', partnerId: new Types.ObjectId() } : null) }),
    });
    (PartnerLocationModel as unknown as { findOne: unknown }).findOne = () => ({ lean: async () => storedLocation });
    httpServer = http.createServer();
    initSockets(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, r));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });
  after(() => {
    open.forEach((s) => s.close());
    httpServer.close();
  });

  it('rejects another customer (RESOURCE_FORBIDDEN)', async () => {
    const res = await join(await connectAs('customer', strangerUser), myBooking);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'RESOURCE_FORBIDDEN');
  });
  it('rejects the assigned partner and admins: only the booking owner tracks', async () => {
    assert.equal((await join(await connectAs('partner', partnerUser), myBooking)).code, 'RESOURCE_FORBIDDEN');
    assert.equal((await join(await connectAs('admin', adminUser), myBooking)).code, 'RESOURCE_FORBIDDEN');
  });
  it('rejects a booking that does not exist the same way as one that is not yours', async () => {
    assert.equal((await join(await connectAs('customer', customerUser), missingBooking)).code, 'RESOURCE_FORBIDDEN');
  });
  it('rejects a malformed bookingId (VALIDATION_ERROR)', async () => {
    assert.equal((await join(await connectAs('customer', customerUser), 'abc')).code, 'VALIDATION_ERROR');
  });

  it('lets the owner in and returns status with no location yet', async () => {
    storedLocation = null;
    const res = await join(await connectAs('customer', customerUser), myBooking);
    assert.equal(res.ok, true);
    assert.equal(res.snapshot?.status, 'en_route');
    assert.equal(res.snapshot?.partnerAssigned, true);
    assert.deepEqual(res.snapshot?.location, { sharing: false, lat: null, lng: null, accuracy: null, heading: null, updatedAt: null });
  });

  it('reconnect snapshot carries the last known location', async () => {
    storedLocation = { sharing: false, lat: 16.5, lng: 80.6, accuracy: 12, updatedAt };
    const res = await join(await connectAs('customer', customerUser), myBooking);
    assert.equal(res.ok, true);
    assert.deepEqual(res.snapshot?.location, {
      sharing: false,
      lat: 16.5,
      lng: 80.6,
      accuracy: 12,
      heading: null,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('relays tracking:location and tracking:status to joined sockets only', async () => {
    const owner = await connectAs('customer', customerUser);
    const outsider = await connectAs('customer', strangerUser);
    assert.equal((await join(owner, myBooking)).ok, true);
    await join(outsider, myBooking); // refused, so never in the room

    const ownerGot: Array<[string, Record<string, unknown>]> = [];
    const outsiderGot: string[] = [];
    owner.on('tracking:location', (p) => ownerGot.push(['location', p]));
    owner.on('tracking:status', (p) => ownerGot.push(['status', p]));
    outsider.onAny((event) => outsiderGot.push(event));

    trackingService.emitLocation(myBooking, { sharing: true, lat: 16.51, lng: 80.61, accuracy: 8, heading: 90, updatedAt: updatedAt.toISOString() });
    trackingService.emitStatus(myBooking, 'arrived', updatedAt);
    await wait(100);

    assert.deepEqual(ownerGot.map(([kind]) => kind), ['location', 'status']);
    assert.equal(ownerGot[0][1].bookingId, myBooking);
    assert.equal(ownerGot[0][1].lat, 16.51);
    assert.equal(ownerGot[1][1].status, 'arrived');
    assert.deepEqual(outsiderGot, []);
  });

  it('stops receiving after tracking:leave', async () => {
    const owner = await connectAs('customer', customerUser);
    await join(owner, myBooking);
    owner.emit('tracking:leave', { bookingId: myBooking });
    await wait(50);
    let got = 0;
    owner.on('tracking:status', () => got++);
    trackingService.emitStatus(myBooking, 'in_progress');
    await wait(100);
    assert.equal(got, 0);
  });
});