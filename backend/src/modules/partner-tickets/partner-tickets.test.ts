import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import * as repo from './partner-tickets.repository';
import { partnerTicketsRoutes } from './partner-tickets.routes';
import { isSafeAttachmentUrl } from './partner-tickets.validation';

const oid = () => new Types.ObjectId();
const ME = oid();
const OTHER = oid();
const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const tokenFor = (sub: string, role: string) => jwt.sign({ sub, role }, secret, { expiresIn: '5m' });

type Row = Record<string, unknown> & { _id: Types.ObjectId };
const tickets: Row[] = [];
const messages: Row[] = [];
const mkTicket = (createdBy: Types.ObjectId, status = 'open'): Row => {
  const t: Row = {
    _id: oid(), createdBy, createdByRole: 'partner', bookingId: null, category: 'payment', subject: 'Help',
    status, priority: 'normal', assignedTo: null, lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };
  tickets.push(t);
  return t;
};

const original = { ...repo };
const patch = repo as unknown as Record<string, unknown>;
const doc = (row: Row) => ({ ...row, toObject: () => row });

let server: ReturnType<ReturnType<typeof express>['listen']>;
let base = '';

before(async () => {
  patch.createTicket = async (d: Row) => doc(mkTicketFrom(d));
  patch.createMessage = async (d: Row) => {
    const m: Row = { readAt: null, createdAt: new Date(), ...d, _id: oid() };
    messages.push(m);
    return doc(m);
  };
  patch.findTicketsByOwner = async (id: string) => tickets.filter((t) => String(t.createdBy) === id);
  patch.findTicketById = async (id: string) => tickets.find((t) => String(t._id) === id) ?? null;
  patch.findPublicMessages = async (id: string) => messages.filter((m) => String(m.ticketId) === id);
  patch.touchTicket = async () => undefined;

  const app = express();
  app.use(express.json());
  app.use('/api/v1/partner/support/tickets', partnerTicketsRoutes);
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/partner/support/tickets`;
});

function mkTicketFrom(d: Row): Row {
  const t: Row = { status: 'open', assignedTo: null, lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(), ...d, _id: oid() };
  tickets.push(t);
  return t;
}

after(() => {
  Object.assign(repo, original);
  server.close();
});

const call = (path: string, init: { method?: string; token?: string; body?: unknown } = {}) =>
  fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

const partner = () => tokenFor(String(ME), 'partner');

describe('partner tickets API', () => {
  test('no token -> 401', async () => {
    assert.equal((await call('/')).status, 401);
  });

  test('wrong role -> 403', async () => {
    const res = await call('/', { token: tokenFor(String(ME), 'customer') });
    assert.equal(res.status, 403);
  });

  test('create: success, then listed', async () => {
    const res = await call('/', { method: 'POST', token: partner(), body: { category: 'payment', subject: 'Missing payout', body: 'Not received' } });
    assert.equal(res.status, 201);
    const list = (await (await call('/', { token: partner() })).json()) as { data: unknown[] };
    assert.ok(list.data.length >= 1);
  });

  test('create: missing fields -> 400 with field errors', async () => {
    const res = await call('/', { method: 'POST', token: partner(), body: {} });
    assert.equal(res.status, 400);
    const j = (await res.json()) as { errors: Record<string, string> };
    assert.ok(j.errors.category && j.errors.subject && j.errors.body);
  });

  test('create: invalid category -> 400', async () => {
    const res = await call('/', { method: 'POST', token: partner(), body: { category: 'nope', subject: 's', body: 'b' } });
    assert.equal(res.status, 400);
  });

  test('another partner ticket -> 404 (get and reply)', async () => {
    const t = mkTicket(OTHER);
    assert.equal((await call(`/${t._id}`, { token: partner() })).status, 404);
    assert.equal((await call(`/${t._id}/reply`, { method: 'POST', token: partner(), body: { body: 'hi' } })).status, 404);
  });

  test('reply: success returns message', async () => {
    const t = mkTicket(ME);
    const res = await call(`/${t._id}/reply`, { method: 'POST', token: partner(), body: { body: 'Any update?' } });
    assert.equal(res.status, 201);
    const j = (await res.json()) as { data: { body: string; senderRole: string } };
    assert.equal(j.data.body, 'Any update?');
    assert.equal(j.data.senderRole, 'partner');
  });

  test('reply: empty / whitespace message -> 400', async () => {
    const t = mkTicket(ME);
    assert.equal((await call(`/${t._id}/reply`, { method: 'POST', token: partner(), body: { body: '   ' } })).status, 400);
  });

  test('reply: closed ticket is read-only -> 409', async () => {
    const t = mkTicket(ME, 'closed');
    assert.equal((await call(`/${t._id}/reply`, { method: 'POST', token: partner(), body: { body: 'hello' } })).status, 409);
  });

  test('reply: bad attachment type / size / url -> 400', async () => {
    const t = mkTicket(ME);
    const att = (o: object) => ({ url: 'https://files.example.com/a.png', name: 'a.png', mimeType: 'image/png', sizeBytes: 1000, ...o });
    for (const bad of [att({ mimeType: 'application/zip' }), att({ sizeBytes: 6 * 1024 * 1024 }), att({ url: 'javascript:alert(1)' })]) {
      const res = await call(`/${t._id}/reply`, { method: 'POST', token: partner(), body: { body: 'x', attachments: [bad] } });
      assert.equal(res.status, 400);
    }
  });
});

describe('isSafeAttachmentUrl', () => {
  test('https only', () => {
    assert.equal(isSafeAttachmentUrl('https://cdn.example.com/a.png'), true);
    assert.equal(isSafeAttachmentUrl('http://cdn.example.com/a.png'), false);
    assert.equal(isSafeAttachmentUrl('data:text/html,hi'), false);
    assert.equal(isSafeAttachmentUrl('not a url'), false);
  });
});