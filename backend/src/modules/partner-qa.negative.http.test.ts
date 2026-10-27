import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { errorHandler, notFoundHandler } from '../middleware/error.middleware';
import { earningsRoutes } from './earnings/earnings.routes';
import { incentivesRoutes } from './incentives/incentives.routes';
import { partnerPayoutsRoutes } from './partner-payouts/partner-payouts.routes';
import { partnerPerformanceRoutes } from './partner-performance/partner-performance.routes';
import { partnerReviewsRoutes } from './partner-reviews/partner-reviews.routes';
import { partnerTicketsRoutes } from './partner-tickets/partner-tickets.routes';
import partnerWalletRoutes, { partnerWalletSummaryRoutes } from './partner-wallet/partner-wallet.routes';
import { sosRoutes } from './sos/sos.routes';

/**
 * Day 17 negative suite for D02-D09 (earnings, incentives, payouts, wallet, transactions,
 * performance, reviews, support tickets, safety/SOS).
 *
 * The REAL routers, auth, role + permission checks and validation run over HTTP with no database
 * (mongoose buffering is off). A bad request that slips past validation reaches the DB, fails fast
 * and shows up here as a 500, so every 4xx below proves "rejected before any work was done".
 */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const ME = new Types.ObjectId().toString();
const OTHER = new Types.ObjectId().toString();
const OID = new Types.ObjectId().toString();
const sign = (role: string, opts: jwt.SignOptions = { expiresIn: '5m' }) => jwt.sign({ sub: ME, role }, secret, opts);
const PARTNER = sign('partner');

let base = '';
let close: () => Promise<void>;

before(async () => {
  mongoose.set('bufferCommands', false);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/partner/earnings', earningsRoutes);
  app.use('/partner/incentives', incentivesRoutes);
  app.use('/partner/payouts', partnerPayoutsRoutes);
  app.use('/partner/transactions', partnerWalletRoutes);
  app.use('/partner/wallet', partnerWalletSummaryRoutes);
  app.use('/partner/performance', partnerPerformanceRoutes);
  app.use('/partner/reviews', partnerReviewsRoutes);
  app.use('/partner/support/tickets', partnerTicketsRoutes);
  app.use('/partner/safety', sosRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(async () => close());

interface Opts {
  token?: string | null;
  json?: unknown;
  raw?: string;
}
async function call(method: string, path: string, { token = PARTNER, json, raw }: Opts = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = raw;
  }
  const res = await fetch(base + path, { method, headers, body });
  const text = await res.text();
  let parsed: { success?: boolean; code?: string; message?: string; errors?: Record<string, string> } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

type Case = { name: string; method: string; path: string; opts?: Opts; status?: number };

function run(title: string, cases: Case[]) {
  describe(title, () => {
    for (const c of cases) {
      test(c.name, async () => {
        const r = await call(c.method, c.path, c.opts);
        const want = c.status ?? 400;
        assert.notEqual(r.status, 500, `bad input reached the database / crashed: ${r.text}`);
        assert.equal(r.status, want, `${c.method} ${c.path} -> ${r.status} ${r.text}`);
        assert.equal(r.body.success, false, 'must use the error envelope');
        assert.equal(typeof r.body.message, 'string');
      });
    }
  });
}

const get = (name: string, path: string, extra: Partial<Case> = {}): Case => ({ name, method: 'GET', path, ...extra });
const send = (method: string, name: string, path: string, json: unknown, extra: Partial<Case> = {}): Case => ({
  name,
  method,
  path,
  opts: { json },
  ...extra,
});

/* ---------------- security: auth + role on every route ---------------- */
const ROUTES: [string, string, unknown?][] = [
  ['GET', '/partner/earnings'],
  ['GET', '/partner/earnings/summary'],
  ['GET', '/partner/earnings/export'],
  ['GET', '/partner/incentives'],
  ['GET', `/partner/incentives/${OID}`],
  ['GET', '/partner/payouts'],
  ['GET', `/partner/payouts/${OID}`],
  ['GET', '/partner/wallet'],
  ['GET', '/partner/transactions'],
  ['GET', '/partner/performance'],
  ['GET', '/partner/performance/trends'],
  ['GET', '/partner/reviews'],
  ['GET', '/partner/reviews/summary'],
  ['GET', '/partner/support/tickets'],
  ['POST', '/partner/support/tickets', { category: 'booking', subject: 's', body: 'b' }],
  ['GET', `/partner/support/tickets/${OID}`],
  ['POST', `/partner/support/tickets/${OID}/reply`, { body: 'hello' }],
  ['POST', '/partner/safety/sos', {}],
];

describe('security: every D02-D09 route', () => {
  for (const [method, path, json] of ROUTES) {
    const label = `${method} ${path.replace(/[0-9a-f]{24}/, ':id')}`;
    test(`no token -> 401: ${label}`, async () => {
      assert.equal((await call(method, path, { token: null, json })).status, 401);
    });
    test(`garbage token -> 401: ${label}`, async () => {
      assert.equal((await call(method, path, { token: 'not.a.jwt', json })).status, 401);
    });
    test(`expired token -> 401 (client must refresh): ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('partner', { expiresIn: -60 }), json })).status, 401);
    });
    test(`token signed with the wrong secret -> 401: ${label}`, async () => {
      const bad = jwt.sign({ sub: ME, role: 'partner' }, 'wrong-secret');
      assert.equal((await call(method, path, { token: bad, json })).status, 401);
    });
    test(`customer token -> 403: ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('customer'), json })).status, 403);
    });
    test(`admin token -> 403: ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('admin'), json })).status, 403);
    });
  }
});

describe('security: Authorization header shapes', () => {
  test('"Basic" scheme is not accepted -> 401', async () => {
    const res = await fetch(`${base}/partner/wallet`, { headers: { Authorization: `Basic ${PARTNER}` } });
    assert.equal(res.status, 401);
  });
  test('token without the Bearer prefix -> 401', async () => {
    const res = await fetch(`${base}/partner/wallet`, { headers: { Authorization: PARTNER } });
    assert.equal(res.status, 401);
  });
  test('"Bearer " with an empty token -> 401', async () => {
    const res = await fetch(`${base}/partner/wallet`, { headers: { Authorization: 'Bearer ' } });
    assert.equal(res.status, 401);
  });
  test('alg=none token -> 401', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ME, role: 'partner' })}.`;
    const res = await fetch(`${base}/partner/wallet`, { headers: { Authorization: `Bearer ${none}` } });
    assert.equal(res.status, 401);
  });
});

/* ---------------- D02 earnings ---------------- */
run('D02 GET /partner/earnings (ledger)', [
  get('unknown query param', '/partner/earnings?foo=1'),
  get('status not in the list', '/partner/earnings?status=refunded-ish'),
  get('from not a date', '/partner/earnings?from=yesterday'),
  get('from in DD-MM-YYYY', '/partner/earnings?from=31-10-2026'),
  get('impossible from 2026-02-30', '/partner/earnings?from=2026-02-30'),
  get('impossible to 2026-13-01', '/partner/earnings?to=2026-13-01'),
  get('from after to', '/partner/earnings?from=2026-10-31&to=2026-10-01'),
  get('custom range longer than a year', '/partner/earnings?from=2024-01-01&to=2026-01-01'),
  get('page 0', '/partner/earnings?page=0'),
  get('negative page', '/partner/earnings?page=-1'),
  get('fractional page', '/partner/earnings?page=1.5'),
  get('page not a number', '/partner/earnings?page=abc'),
  get('limit 0', '/partner/earnings?limit=0'),
  get('limit above 100', '/partner/earnings?limit=101'),
  get('limit not a number', '/partner/earnings?limit=lots'),
  get('partnerId (cannot read another partner)', `/partner/earnings?partnerId=${OTHER}`),
  get('status as operator injection', '/partner/earnings?status[$ne]=paid'),
]);

run('D02 GET /partner/earnings/summary', [
  get('unknown query param', '/partner/earnings/summary?range=week'),
  get('malformed partnerId', '/partner/earnings/summary?partnerId=abc'),
  get('partnerId as array', `/partner/earnings/summary?partnerId=${ME}&partnerId=${OTHER}`),
  get('partnerId as operator injection', '/partner/earnings/summary?partnerId[$ne]=x'),
]);

run('D02 GET /partner/earnings/export (CSV)', [
  get('unknown query param', '/partner/earnings/export?format=xlsx'),
  get('page is not accepted on export', '/partner/earnings/export?page=2'),
  get('bad status', '/partner/earnings/export?status=nope'),
  get('impossible from', '/partner/earnings/export?from=2026-02-31'),
  get('from after to', '/partner/earnings/export?from=2026-10-31&to=2026-10-01'),
  get('range longer than a year', '/partner/earnings/export?from=2020-01-01&to=2026-10-01'),
]);

/* ---------------- D03 incentives ---------------- */
run('D03 /partner/incentives', [
  get('list takes no query params', '/partner/incentives?status=active'),
  get('list: partnerId is not accepted', `/partner/incentives?partnerId=${OTHER}`),
  get('detail: malformed id', '/partner/incentives/not-an-id'),
  get('detail: id too short', '/partner/incentives/123'),
  get('detail: id too long', `/partner/incentives/${OID}0`),
  get('detail: operator characters in id', '/partner/incentives/%7B%22$ne%22:1%7D'),
]);

/* ---------------- D04 payouts ---------------- */
run('D04 /partner/payouts', [
  get('list: unknown status', '/partner/payouts?status=cancelled-by-moon'),
  get('list: limit 0', '/partner/payouts?limit=0'),
  get('list: limit above 100', '/partner/payouts?limit=500'),
  get('list: limit not a number', '/partner/payouts?limit=all'),
  get('list: unknown query param', '/partner/payouts?partnerId=' + OTHER),
  get('list: status as operator injection', '/partner/payouts?status[$ne]=paid'),
  get('detail: malformed id', '/partner/payouts/not-an-id'),
  get('detail: id too short', '/partner/payouts/123'),
  get('detail: id too long', `/partner/payouts/${OID}0`),
]);

/* ---------------- D05 wallet + transactions ---------------- */
run('D05 GET /partner/transactions', [
  get('unknown type', '/partner/transactions?type=bonus'),
  get('unknown query param', '/partner/transactions?walletId=x'),
  get('malformed partnerId', '/partner/transactions?partnerId=abc'),
  get('impossible from', '/partner/transactions?from=2026-02-30'),
  get('from in DD-MM-YYYY', '/partner/transactions?from=30-09-2026'),
  get('from after to', '/partner/transactions?from=2026-10-05&to=2026-10-01'),
  get('page 0', '/partner/transactions?page=0'),
  get('fractional page', '/partner/transactions?page=2.5'),
  get('limit above 100', '/partner/transactions?limit=101'),
  get('limit not a number', '/partner/transactions?limit=ten'),
  get('type as operator injection', '/partner/transactions?type[$ne]=payout'),
]);

// Wallet summary takes no input; extra query params are ignored by design, but auth/role still apply (see security block).

/* ---------------- D06 performance ---------------- */
run('D06 /partner/performance', [
  get('summary: unknown query param', '/partner/performance?period=week'),
  get('summary: malformed partnerId', '/partner/performance?partnerId=abc'),
  get('trends: unknown query param', '/partner/performance/trends?months=6'),
  get('trends: malformed partnerId', '/partner/performance/trends?partnerId=abc'),
  get('trends: partnerId as operator injection', '/partner/performance/trends?partnerId[$ne]=x'),
]);

/* ---------------- D07 reviews ---------------- */
run('D07 /partner/reviews', [
  get('list: page 0', '/partner/reviews?page=0'),
  get('list: fractional page', '/partner/reviews?page=1.5'),
  get('list: page not a number', '/partner/reviews?page=abc'),
  get('list: limit 0', '/partner/reviews?limit=0'),
  get('list: limit far above the maximum', '/partner/reviews?limit=100000'),
  get('list: unknown query param', '/partner/reviews?visible=false'),
  get('list: hidden reviews cannot be requested', '/partner/reviews?status=hidden'),
  get('list: malformed partnerId', '/partner/reviews?partnerId=abc'),
  get('summary: unknown query param', '/partner/reviews/summary?page=1'),
  get('summary: malformed partnerId', '/partner/reviews/summary?partnerId=abc'),
]);

/* ---------------- D08 support tickets ---------------- */
const ok = { category: 'booking', subject: 'Help me', body: 'Something went wrong with a job.' };
const pdf = { url: 'https://cdn.example.com/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1000 };

run('D08 POST /partner/support/tickets (create)', [
  send('POST', 'empty body', '/partner/support/tickets', {}),
  send('POST', 'missing category', '/partner/support/tickets', { subject: 's', body: 'b' }),
  send('POST', 'unknown category', '/partner/support/tickets', { ...ok, category: 'gossip' }),
  send('POST', 'missing subject', '/partner/support/tickets', { category: 'booking', body: 'b' }),
  send('POST', 'whitespace-only subject', '/partner/support/tickets', { ...ok, subject: '    ' }),
  send('POST', 'subject over 200 characters', '/partner/support/tickets', { ...ok, subject: 'x'.repeat(201) }),
  send('POST', 'missing message', '/partner/support/tickets', { category: 'booking', subject: 's' }),
  send('POST', 'whitespace-only message', '/partner/support/tickets', { ...ok, body: '   \n  ' }),
  send('POST', 'message over 4000 characters', '/partner/support/tickets', { ...ok, body: 'x'.repeat(4001) }),
  send('POST', 'subject as number', '/partner/support/tickets', { ...ok, subject: 123 }),
  send('POST', 'subject as object (operator injection)', '/partner/support/tickets', { ...ok, subject: { $ne: '' } }),
  send('POST', 'invalid priority', '/partner/support/tickets', { ...ok, priority: 'asap' }),
  send('POST', 'malformed bookingId', '/partner/support/tickets', { ...ok, bookingId: 'not-an-id' }),
  send('POST', 'attachments not an array', '/partner/support/tickets', { ...ok, attachments: 'file.pdf' }),
  send('POST', 'more than 5 attachments', '/partner/support/tickets', { ...ok, attachments: Array(6).fill(pdf) }),
  send('POST', 'attachment missing fields', '/partner/support/tickets', { ...ok, attachments: [{ url: pdf.url }] }),
  send('POST', 'attachment over 5 MB', '/partner/support/tickets', { ...ok, attachments: [{ ...pdf, sizeBytes: 6 * 1024 * 1024 }] }),
  send('POST', 'attachment of zero bytes', '/partner/support/tickets', { ...ok, attachments: [{ ...pdf, sizeBytes: 0 }] }),
  send('POST', 'attachment type not allowed (.exe)', '/partner/support/tickets', {
    ...ok,
    attachments: [{ ...pdf, name: 'a.exe', mimeType: 'application/x-msdownload' }],
  }),
  send('POST', 'attachment type not allowed (SVG can carry scripts)', '/partner/support/tickets', {
    ...ok,
    attachments: [{ ...pdf, name: 'a.svg', mimeType: 'image/svg+xml' }],
  }),
  send('POST', 'attachment url javascript:', '/partner/support/tickets', {
    ...ok,
    attachments: [{ ...pdf, url: 'javascript:alert(1)' }],
  }),
  send('POST', 'attachment url data:', '/partner/support/tickets', {
    ...ok,
    attachments: [{ ...pdf, url: 'data:application/pdf;base64,AAAA' }],
  }),
  send('POST', 'attachment url plain http', '/partner/support/tickets', {
    ...ok,
    attachments: [{ ...pdf, url: 'http://cdn.example.com/a.pdf' }],
  }),
  send('POST', 'attachment url not a URL', '/partner/support/tickets', { ...ok, attachments: [{ ...pdf, url: 'hello' }] }),
  { name: 'malformed JSON', method: 'POST', path: '/partner/support/tickets', opts: { raw: '{"subject": ' } },
  {
    name: 'oversized body -> 413',
    method: 'POST',
    path: '/partner/support/tickets',
    opts: { json: { ...ok, body: 'x'.repeat(200_000) } },
    status: 413,
  },
]);

run('D08 GET /partner/support/tickets/:id and reply', [
  get('detail: malformed id', '/partner/support/tickets/not-an-id'),
  get('detail: id too short', '/partner/support/tickets/123'),
  send('POST', 'reply: malformed id', '/partner/support/tickets/not-an-id/reply', { body: 'hello' }),
  send('POST', 'reply: empty body', `/partner/support/tickets/${OID}/reply`, {}),
  send('POST', 'reply: whitespace-only message', `/partner/support/tickets/${OID}/reply`, { body: '   ' }),
  send('POST', 'reply: message over 4000 characters', `/partner/support/tickets/${OID}/reply`, { body: 'x'.repeat(4001) }),
  send('POST', 'reply: message as number', `/partner/support/tickets/${OID}/reply`, { body: 7 }),
  send('POST', 'reply: bad attachment type', `/partner/support/tickets/${OID}/reply`, {
    body: 'see file',
    attachments: [{ ...pdf, mimeType: 'text/html' }],
  }),
  send('POST', 'reply: javascript: attachment url', `/partner/support/tickets/${OID}/reply`, {
    body: 'see file',
    attachments: [{ ...pdf, url: 'javascript:alert(1)' }],
  }),
]);

/* ---------------- D09 safety / SOS ---------------- */
// Each SOS case signs in as its own partner: the route allows 10 presses a minute per partner, and this block has more cases than that.
const freshPartner = () => jwt.sign({ sub: new Types.ObjectId().toString(), role: 'partner' }, secret, { expiresIn: '5m' });
const sos = (name: string, json: unknown, extra: Partial<Case> = {}): Case => ({
  name,
  method: 'POST',
  path: '/partner/safety/sos',
  opts: { json, token: freshPartner() },
  ...extra,
});

run('D09 POST /partner/safety/sos', [
  sos('unknown key', { foo: 1 }),
  sos('partnerId is never accepted from the body', { partnerId: OTHER }),
  sos('malformed bookingId', { bookingId: 'abc' }),
  sos('latitude above 90', { location: { lat: 91, lng: 77 } }),
  sos('latitude below -90', { location: { lat: -90.5, lng: 77 } }),
  sos('longitude above 180', { location: { lat: 17, lng: 181 } }),
  sos('longitude below -180', { location: { lat: 17, lng: -181 } }),
  sos('location lat as string', { location: { lat: '17.3', lng: 78.4 } }),
  sos('location missing lng', { location: { lat: 17.3 } }),
  sos('location with an extra key', { location: { lat: 17.3, lng: 78.4, altitude: 5 } }),
  sos('negative accuracy', { location: { lat: 17.3, lng: 78.4, accuracy: -1 } }),
  sos('absurd accuracy', { location: { lat: 17.3, lng: 78.4, accuracy: 1e9 } }),
  sos('location as a string', { location: '17.3,78.4' }),
  sos('note over 500 characters', { note: 'x'.repeat(501) }),
  sos('note as number', { note: 911 }),
  sos('array body', [{ note: 'help' }]),
  { name: 'malformed JSON', method: 'POST', path: '/partner/safety/sos', opts: { raw: '{"note": ', token: freshPartner() } },
]);

describe('D09 POST /partner/safety/sos: abuse protection', () => {
  test('a flood of SOS requests from one partner is rate-limited (429), never a crash', async () => {
    // A fresh partner so earlier cases do not count against this one. Invalid bodies still pass through
    // the limiter, so they are enough to trip it without touching the database.
    const flooder = jwt.sign({ sub: new Types.ObjectId().toString(), role: 'partner' }, secret, { expiresIn: '5m' });
    const statuses: number[] = [];
    for (let i = 0; i < 14; i += 1) {
      statuses.push((await call('POST', '/partner/safety/sos', { token: flooder, json: { foo: 1 } })).status);
    }
    assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
    assert.ok(!statuses.includes(500), `no 500s allowed: ${statuses.join(',')}`);
  });
});

/* ---------------- unknown routes + methods ---------------- */
describe('unknown routes and wrong methods', () => {
  test('POST on a read-only route -> 404, not 500', async () => {
    assert.equal((await call('POST', '/partner/wallet', { json: {} })).status, 404);
  });
  test('DELETE on earnings -> 404', async () => {
    assert.equal((await call('DELETE', '/partner/earnings')).status, 404);
  });
  test('PATCH on a ticket -> 404', async () => {
    assert.equal((await call('PATCH', `/partner/support/tickets/${OID}`, { json: { status: 'closed' } })).status, 404);
  });
  test('unknown sub-route -> 404', async () => {
    assert.equal((await call('GET', '/partner/earnings/secret')).status, 404);
  });
});
