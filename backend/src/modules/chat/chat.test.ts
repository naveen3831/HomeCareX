import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { chatRepository: repo } = require('./chat.repository') as typeof import('./chat.repository');
const { chatNotifier } = require('./chat.service') as typeof import('./chat.service');
/* eslint-enable @typescript-eslint/no-require-imports */

type MessageDoc = import('./chat.repository').MessageDoc;
type ChatBookingDoc = import('./chat.repository').ChatBookingDoc;

const customerUserId = new Types.ObjectId().toString();
const strangerCustomerId = new Types.ObjectId().toString();
const partnerUserId = new Types.ObjectId().toString();
const otherPartnerUserId = new Types.ObjectId().toString();
const adminUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const otherPartnerId = new Types.ObjectId();
const bookingId = new Types.ObjectId();
const token = (role: string, sub: string) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let booking: ChatBookingDoc;
let store: MessageDoc[];
let emitted: Array<{ bookingId: string; text: string }>;

let server: Server;
let base: string;
const url = (id: string, qs = '') => `${base}/api/v1/bookings/${id}/messages${qs}`;
const send = (id: string, body: unknown, bearer?: string) =>
  fetch(url(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const list = (id: string, bearer?: string, qs = '') => fetch(url(id, qs), { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const code = async (res: Response) => ((await res.json()) as { code: string }).code;

describe('booking chat', () => {
  before(() => {
    repo.findBooking = (async (id: string) => (id === bookingId.toString() ? booking : null)) as unknown as typeof repo.findBooking;
    repo.findPartnerByUserId = (async (userId: string) =>
      userId === partnerUserId ? { _id: partnerId } : userId === otherPartnerUserId ? { _id: otherPartnerId } : null) as unknown as typeof repo.findPartnerByUserId;
    repo.createMessage = (async (input) => {
      const doc: MessageDoc = {
        _id: new Types.ObjectId(),
        bookingId: input.bookingId,
        senderId: new Types.ObjectId(input.senderId),
        senderRole: input.senderRole,
        text: input.text,
        attachments: input.attachments,
        createdAt: new Date(),
      };
      store.push(doc);
      return doc;
    }) as typeof repo.createMessage;
    repo.listMessages = (async (_id: string, limit: number, before?: string) =>
      store
        .filter((m) => !before || m._id.toString() < before)
        .sort((a, b) => (a._id.toString() < b._id.toString() ? 1 : -1))
        .slice(0, limit + 1)) as unknown as typeof repo.listMessages;
    chatNotifier.newMessage = (id, m) => void emitted.push({ bookingId: id, text: m.text });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    booking = { _id: bookingId, customerId: new Types.ObjectId(customerUserId), partnerId, status: 'en_route' };
    store = [];
    emitted = [];
  });

  it('works both ways: customer and partner see each other\'s messages', async () => {
    assert.equal((await send(bookingId.toString(), { text: 'On my way' }, token('partner', partnerUserId))).status, 201);
    assert.equal((await send(bookingId.toString(), { text: 'Gate is open' }, token('customer', customerUserId))).status, 201);

    const asCustomer = (await (await list(bookingId.toString(), token('customer', customerUserId))).json()) as {
      data: Array<{ text: string; senderRole: string; mine: boolean }>;
    };
    assert.deepEqual(asCustomer.data.map((m) => [m.text, m.senderRole, m.mine]), [
      ['On my way', 'partner', false],
      ['Gate is open', 'customer', true],
    ]);
    const asPartner = (await (await list(bookingId.toString(), token('partner', partnerUserId))).json()) as { data: Array<{ mine: boolean }> };
    assert.deepEqual(asPartner.data.map((m) => m.mine), [true, false]);
  });

  it('emits partner:new_message payload to the booking room after storing', async () => {
    await send(bookingId.toString(), { text: 'hello' }, token('customer', customerUserId));
    assert.deepEqual(emitted, [{ bookingId: bookingId.toString(), text: 'hello' }]);
  });

  it('accepts photo attachments (https only)', async () => {
    const ok = await send(bookingId.toString(), { attachments: [{ url: 'https://cdn.example.com/a.jpg' }] }, token('partner', partnerUserId));
    assert.equal(ok.status, 201);
    const bad = await send(bookingId.toString(), { attachments: [{ url: 'http://cdn.example.com/a.jpg' }] }, token('partner', partnerUserId));
    assert.equal(bad.status, 400);
  });

  it('rejects a message outside the booking (another customer / another partner)', async () => {
    const asStranger = await send(bookingId.toString(), { text: 'hi' }, token('customer', strangerCustomerId));
    assert.equal(asStranger.status, 403);
    assert.equal(await code(asStranger), 'RESOURCE_FORBIDDEN');
    const asOtherPartner = await send(bookingId.toString(), { text: 'hi' }, token('partner', otherPartnerUserId));
    assert.equal(asOtherPartner.status, 403);
    assert.equal(store.length, 0);
    assert.equal(emitted.length, 0);
  });

  it('does not let strangers read the thread', async () => {
    store.push({ _id: new Types.ObjectId(), bookingId, senderId: new Types.ObjectId(customerUserId), senderRole: 'customer', text: 'secret', createdAt: new Date() });
    assert.equal((await list(bookingId.toString(), token('customer', strangerCustomerId))).status, 403);
    assert.equal((await list(bookingId.toString(), token('partner', otherPartnerUserId))).status, 403);
  });

  it('401 without token, 404 for unknown booking, 400 for bad id', async () => {
    assert.equal((await send(bookingId.toString(), { text: 'x' })).status, 401);
    assert.equal((await list(bookingId.toString())).status, 401);
    const missing = await send(new Types.ObjectId().toString(), { text: 'x' }, token('customer', customerUserId));
    assert.equal(missing.status, 404);
    assert.equal(await code(missing), 'BOOKING_NOT_FOUND');
    assert.equal((await send('not-an-id', { text: 'x' }, token('customer', customerUserId))).status, 400);
  });

  it('400 for missing / empty / oversized body', async () => {
    const t = token('customer', customerUserId);
    assert.equal((await send(bookingId.toString(), {}, t)).status, 400);
    assert.equal((await send(bookingId.toString(), { text: '   ' }, t)).status, 400);
    assert.equal((await send(bookingId.toString(), { text: 'a'.repeat(1001) }, t)).status, 400);
    assert.equal((await send(bookingId.toString(), { text: 'hi', extra: 1 }, t)).status, 400);
  });

  it('admin can read but not send', async () => {
    assert.equal((await list(bookingId.toString(), token('admin', adminUserId))).status, 200);
    assert.equal((await send(bookingId.toString(), { text: 'x' }, token('admin', adminUserId))).status, 403);
  });

  it('409 when no partner is assigned or booking is closed', async () => {
    booking.partnerId = null;
    assert.equal((await send(bookingId.toString(), { text: 'x' }, token('customer', customerUserId))).status, 409);
    booking.partnerId = partnerId;
    booking.status = 'cancelled_by_customer';
    assert.equal((await send(bookingId.toString(), { text: 'x' }, token('customer', customerUserId))).status, 409);
    assert.equal((await list(bookingId.toString(), token('customer', customerUserId))).status, 200);
  });

  it('paginates with nextCursor', async () => {
    for (let i = 0; i < 3; i++) await send(bookingId.toString(), { text: `m${i}` }, token('customer', customerUserId));
    const first = (await (await list(bookingId.toString(), token('customer', customerUserId), '?limit=2')).json()) as {
      data: Array<{ text: string }>;
      meta: { nextCursor: string | null };
    };
    assert.deepEqual(first.data.map((m) => m.text), ['m1', 'm2']);
    assert.ok(first.meta.nextCursor);
    const second = (await (await list(bookingId.toString(), token('customer', customerUserId), `?limit=2&before=${first.meta.nextCursor}`)).json()) as {
      data: Array<{ text: string }>;
      meta: { nextCursor: string | null };
    };
    assert.deepEqual(second.data.map((m) => m.text), ['m0']);
    assert.equal(second.meta.nextCursor, null);
  });
});