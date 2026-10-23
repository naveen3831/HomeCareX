import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { errorHandler, notFoundHandler } from '../middleware/error.middleware';
import { addressesRoutes, serviceabilityRoutes } from './addresses/addresses.routes';
import { catalogRoutes } from './catalog/catalog.routes';
import { customerDashboardRoutes } from './customer-dashboard/customer-dashboard.routes';
import { customerPreferencesRoutes, customerProfileRoutes } from './customer-profile/customer-profile.routes';
import customerNotificationsRoutes from './notifications/customer-notifications.routes';
import notificationsRoutes from './notifications/notifications.routes';
import { reviewsRoutes } from './reviews/reviews.routes';

/**
 * N02-N07 negative suite: invalid query / body / params / auth on every customer endpoint.
 *
 * The REAL routers, auth, validation and error handler run over HTTP. There is no database:
 * mongoose buffering is off, so if a bad request ever gets past validation and reaches the DB it
 * fails fast and the case below fails with a 500. Every case therefore proves "rejected before any
 * work was done", with the right status and the standard error envelope.
 */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const ME = new Types.ObjectId().toString();
const OTHER = new Types.ObjectId().toString();
const OID = new Types.ObjectId().toString();
const sign = (role: string, opts: jwt.SignOptions = { expiresIn: '5m' }) => jwt.sign({ sub: ME, role }, secret, opts);
const CUSTOMER = sign('customer');

let base = '';
let close: () => Promise<void>;

before(async () => {
  mongoose.set('bufferCommands', false);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(catalogRoutes);
  app.use(reviewsRoutes);
  app.use('/notifications', notificationsRoutes);
  app.use('/customer/notifications', customerNotificationsRoutes);
  app.use('/serviceability', serviceabilityRoutes);
  app.use('/addresses', addressesRoutes);
  app.use('/customer/dashboard', customerDashboardRoutes);
  app.use('/customer/profile', customerProfileRoutes);
  app.use('/customer/preferences', customerPreferencesRoutes);
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
  raw?: string | Buffer;
  contentType?: string;
}
async function call(method: string, path: string, { token = CUSTOMER, json, raw, contentType }: Opts = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | Buffer | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    headers['Content-Type'] = contentType ?? 'application/json';
    body = raw;
  }
  const res = await fetch(base + path, { method, headers, body });
  const text = await res.text();
  let parsed: { success?: boolean; code?: string; message?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body: parsed, text };
}

type Case = { name: string; method: string; path: string; opts?: Opts; status?: number; code?: string; messageNot?: RegExp };

/** Runs each case: expected status (default 400), error envelope, and never a 500. */
function run(title: string, cases: Case[]) {
  describe(title, () => {
    for (const c of cases) {
      test(c.name, async () => {
        const r = await call(c.method, c.path, c.opts);
        const want = c.status ?? 400;
        assert.notEqual(r.status, 500, `server error (bad input reached the database?): ${r.text}`);
        assert.equal(r.status, want, `${c.method} ${c.path} -> ${r.status} ${r.text}`);
        assert.equal(r.body.success, false, 'must use the error envelope');
        assert.equal(typeof r.body.message, 'string');
        assert.ok(r.body.code, 'error envelope must carry a code');
        if (c.code) assert.equal(r.body.code, c.code);
        if (c.messageNot) assert.doesNotMatch(r.body.message ?? '', c.messageNot);
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

/* ---------------- N01 / cross-cutting: auth, malformed JSON ---------------- */
run('auth and transport (all customer areas)', [
  get('no token -> 401', '/customer/dashboard', { opts: { token: null }, status: 401 }),
  get('garbage token -> 401', '/customer/dashboard', { opts: { token: 'not.a.jwt' }, status: 401 }),
  get('expired token -> 401 so the client refreshes', '/customer/dashboard', { opts: { token: sign('customer', { expiresIn: -60 }) }, status: 401 }),
  get('token signed with the wrong secret -> 401', '/customer/dashboard', { opts: { token: jwt.sign({ sub: ME, role: 'customer' }, 'wrong-secret') }, status: 401 }),
  get('partner token on customer dashboard -> 403', '/customer/dashboard', { opts: { token: sign('partner') }, status: 403 }),
  get('admin token on customer addresses -> 403', '/addresses', { opts: { token: sign('admin') }, status: 403 }),
  get('no token on notifications -> 401', '/customer/notifications', { opts: { token: null }, status: 401 }),
  get('no token on my reviews -> 401', '/reviews', { opts: { token: null }, status: 401 }),
  get('no token on profile -> 401', '/customer/profile', { opts: { token: null }, status: 401 }),
  { name: 'malformed JSON -> 400 INVALID_JSON (profile)', method: 'PATCH', path: '/customer/profile', opts: { raw: '{"name": ' }, code: 'INVALID_JSON' },
  { name: 'malformed JSON -> 400 (address)', method: 'POST', path: '/addresses', opts: { raw: '{bad' } },
  { name: 'malformed JSON -> 400 (review)', method: 'POST', path: '/reviews', opts: { raw: '[[[' } },
  get('unknown route -> 404', '/customer/nope', { status: 404 }),
]);

/* ---------------- N02 dashboard ---------------- */
run('N02 GET /customer/dashboard', [
  get('unknown query param', '/customer/dashboard?foo=1'),
  get('malformed customerId', '/customer/dashboard?customerId=abc'),
  get('customerId array', '/customer/dashboard?customerId=a&customerId=b'),
  get('customerId operator injection', '/customer/dashboard?customerId[$ne]=x'),
  get("another customer's id -> 403", `/customer/dashboard?customerId=${OTHER}`, { status: 403 }),
]);

/* ---------------- N03 catalog ---------------- */
const S = '/services';
run('N03 GET /categories and /services', [
  get('categories: stray param', '/categories?foo=1'),
  get('services: unknown param', `${S}?foo=1`),
  get('page=0', `${S}?page=0`),
  get('page=-1', `${S}?page=-1`),
  get('page=abc', `${S}?page=abc`),
  get('page=1.5', `${S}?page=1.5`),
  get('page repeated (array)', `${S}?page=1&page=2`),
  get('limit=0', `${S}?limit=0`),
  get('limit=51 (max is 50)', `${S}?limit=51`),
  get('limit=abc', `${S}?limit=abc`),
  get('rating=6', `${S}?rating=6`),
  get('rating=-1', `${S}?rating=-1`),
  get('rating=abc', `${S}?rating=abc`),
  get('minPrice=-5', `${S}?minPrice=-5`),
  get('maxPrice=abc', `${S}?maxPrice=abc`),
  get('minPrice > maxPrice', `${S}?minPrice=900&maxPrice=100`),
  get('minPrice=Infinity', `${S}?minPrice=Infinity`),
  get('duration=1 (min 5)', `${S}?duration=1`),
  get('duration=99999', `${S}?duration=99999`),
  get('duration=2.5', `${S}?duration=2.5`),
  get('availability=never', `${S}?availability=never`),
  get('sort=bogus', `${S}?sort=bogus`),
  get('q too long', `${S}?q=${'a'.repeat(500)}`),
  get('q repeated (array)', `${S}?q=a&q=b`),
  get('q object (NoSQL injection)', `${S}?q[$ne]=x`),
  get('category with illegal chars', `${S}?category=${encodeURIComponent('<script>')}`),
  get('category operator injection', `${S}?category[$ne]=x`),
  get('slug with illegal chars', `${S}/${encodeURIComponent('Bad Slug!')}`),
  get('slug too long', `${S}/${'a'.repeat(200)}`),
]);

/* ---------------- N04 / N07 reviews ---------------- */
run('N04 GET /services/:id/reviews', [
  get('invalid service id', '/services/not-an-id/reviews'),
  get('page=0', `${S}/${OID}/reviews?page=0`),
  get('limit=1000', `${S}/${OID}/reviews?limit=1000`),
  get('limit=abc', `${S}/${OID}/reviews?limit=abc`),
  get('unknown param', `${S}/${OID}/reviews?foo=1`),
]);

run('N07 POST /bookings/:id/review', [
  send('POST', 'invalid booking id', '/bookings/xyz/review', { rating: 5 }),
  send('POST', 'missing rating', `/bookings/${OID}/review`, { comment: 'nice' }),
  send('POST', 'rating=0', `/bookings/${OID}/review`, { rating: 0 }),
  send('POST', 'rating=6', `/bookings/${OID}/review`, { rating: 6 }),
  send('POST', 'rating=4.5', `/bookings/${OID}/review`, { rating: 4.5 }),
  send('POST', 'rating as string', `/bookings/${OID}/review`, { rating: 'five' }),
  send('POST', 'comment > 2000 chars', `/bookings/${OID}/review`, { rating: 5, comment: 'x'.repeat(2001) }),
  send('POST', 'comment not a string', `/bookings/${OID}/review`, { rating: 5, comment: { $gt: '' } }),
  send('POST', 'unknown tag', `/bookings/${OID}/review`, { rating: 5, tags: ['Rude'] }),
  send('POST', 'tags not an array', `/bookings/${OID}/review`, { rating: 5, tags: 'On time' }),
  send('POST', 'too many tags', `/bookings/${OID}/review`, { rating: 5, tags: ['On time', 'Clean work', 'Professional', 'Good quality', 'Good communication', 'On time'] }),
  // Regression: every tag on the form (spec N07) must pass validation. The request still fails (the booking
  // id is deliberately invalid) but the message must be about the id, never about the tags.
  send('POST', 'spec tags are accepted (fails only on the bad booking id)', '/bookings/xyz/review', { rating: 5, tags: ['Professional', 'On time', 'Good quality', 'Clean work'] }, { messageNot: /tag/i }),
  send('POST', 'body is an array', `/bookings/${OID}/review`, [1, 2]),
  send('POST', 'empty body', `/bookings/${OID}/review`, {}),
  send('POST', 'partner cannot review', `/bookings/${OID}/review`, { rating: 5 }, { status: 403, opts: { json: { rating: 5 }, token: sign('partner') } }),
]);

run('N07 POST /reviews', [
  send('POST', 'empty body', '/reviews', {}),
  send('POST', 'rating=0', '/reviews', { rating: 0, message: 'x'.repeat(30) }),
  send('POST', 'rating=6', '/reviews', { rating: 6, message: 'x'.repeat(30) }),
  send('POST', 'message too short', '/reviews', { rating: 5, message: 'ok' }),
  send('POST', 'message too long', '/reviews', { rating: 5, message: 'x'.repeat(2001) }),
  send('POST', 'serviceId not an id', '/reviews', { rating: 5, message: 'x'.repeat(30), serviceId: 'abc' }),
  send('POST', 'bookingId without serviceId', '/reviews', { rating: 5, message: 'x'.repeat(30), bookingId: OID }),
  send('POST', 'serviceId operator injection', '/reviews', { rating: 5, message: 'x'.repeat(30), serviceId: { $ne: null } }),
]);

run('N07 GET /reviews, /reviews/mine, /reviews/pending (customer)', [
  get('/reviews unknown param', '/reviews?foo=1'),
  get('/reviews/mine unknown param', '/reviews/mine?foo=1'),
  get('/reviews/pending unknown param', '/reviews/pending?foo=1'),
  get('/reviews page=0', '/reviews?page=0'),
  get('/reviews limit=999', '/reviews?limit=999'),
  get('/reviews malformed customerId', '/reviews?customerId=abc'),
  get('/reviews/pending customerId operator injection', '/reviews/pending?customerId[$ne]=x'),
]);

run('admin reviews (same module)', [
  get('page=0', '/admin/reviews?page=0', { opts: { token: sign('admin') } }),
  get('limit=101', '/admin/reviews?limit=101', { opts: { token: sign('admin') } }),
  get('status=bogus', '/admin/reviews?status=bogus', { opts: { token: sign('admin') } }),
  get('customer is forbidden', '/admin/reviews', { status: 403 }),
  send('PATCH', 'invalid status', `/admin/reviews/${OID}/status`, { status: 'maybe' }, { opts: { json: { status: 'maybe' }, token: sign('admin') } }),
  send('PATCH', 'invalid review id', '/admin/reviews/xyz/status', { status: 'approved' }, { opts: { json: { status: 'approved' }, token: sign('admin') } }),
]);

/* ---------------- N07 notifications ---------------- */
const N = '/customer/notifications';
run('N07 /customer/notifications', [
  get('group=bogus', `${N}?group=bogus`),
  get('unread=maybe', `${N}?unread=maybe`),
  get('limit=0', `${N}?limit=0`),
  get('limit=101', `${N}?limit=101`),
  get('limit=abc', `${N}?limit=abc`),
  get('unknown param', `${N}?foo=1`),
  get('group object injection', `${N}?group[$ne]=x`),
  { name: 'PATCH :id/read with invalid id', method: 'PATCH', path: `${N}/xyz/read` },
  { name: 'DELETE :id with invalid id', method: 'DELETE', path: `${N}/xyz` },
  { name: 'partner cannot use customer notifications', method: 'GET', path: N, opts: { token: sign('partner') }, status: 403 },
]);

run('shared /notifications (any signed-in user)', [
  { name: 'PATCH :id/read with invalid id', method: 'PATCH', path: '/notifications/xyz/read' },
  get('unknown query param', '/notifications?foo=1'),
]);

/* ---------------- N05 addresses ---------------- */
const goodAddress = { label: 'Home', house: '12-3', street: 'Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500081' };
run('N05 addresses and serviceability', [
  send('POST', 'empty body', '/addresses', {}),
  send('POST', 'pincode with 5 digits', '/addresses', { ...goodAddress, pincode: '50008' }),
  send('POST', 'pincode with letters', '/addresses', { ...goodAddress, pincode: '5000AB' }),
  send('POST', 'label not Home/Work/Other', '/addresses', { ...goodAddress, label: 'Office' }),
  send('POST', 'mass-assignment (customerId) rejected', '/addresses', { ...goodAddress, customerId: OTHER }),
  send('POST', 'house missing', '/addresses', { ...goodAddress, house: undefined }),
  send('POST', 'city is a number', '/addresses', { ...goodAddress, city: 12 }),
  send('POST', 'location out of range', '/addresses', { ...goodAddress, location: { lat: 123, lng: 0 } }),
  send('POST', 'isDefault as string', '/addresses', { ...goodAddress, isDefault: 'yes' }),
  send('PATCH', 'invalid id', '/addresses/xyz', { city: 'Warangal' }),
  send('PATCH', 'empty patch', `/addresses/${OID}`, {}),
  send('PATCH', 'bad pincode', `/addresses/${OID}`, { pincode: '12' }),
  { name: 'DELETE invalid id', method: 'DELETE', path: '/addresses/xyz' },
  get('GET /addresses unknown param', '/addresses?foo=1'),
  get('serviceability: pincode missing', '/serviceability'),
  get('serviceability: pincode letters', '/serviceability?pincode=abcdef'),
  get('serviceability: pincode 5 digits', '/serviceability?pincode=50008'),
  get('serviceability: pincode array', '/serviceability?pincode=500081&pincode=500082'),
  get('serviceability: unknown param', '/serviceability?pincode=500081&foo=1'),
  get('addresses/serviceability alias: pincode missing', '/addresses/serviceability'),
  get('addresses/serviceability alias: unknown param', '/addresses/serviceability?pincode=500081&foo=1'),
]);

/* ---------------- N06 profile, avatar, preferences ---------------- */
const P = '/customer/profile';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
run('N06 profile, avatar, preferences', [
  send('PATCH', 'empty body', P, {}),
  send('PATCH', 'name too short', P, { name: 'a' }),
  send('PATCH', 'name too long', P, { name: 'x'.repeat(81) }),
  send('PATCH', 'name not a string', P, { name: 123 }),
  send('PATCH', 'invalid email', P, { email: 'not-an-email' }),
  send('PATCH', 'invalid phone', P, { phone: '12345' }),
  send('PATCH', 'phone starting with 5', P, { phone: '5123456789' }),
  send('PATCH', 'privilege escalation (role) rejected', P, { role: 'admin' }),
  send('PATCH', 'passwordHash rejected', P, { passwordHash: 'x' }),
  send('PATCH', 'body is an array', P, ['name']),
  get('GET profile unknown param', `${P}?foo=1`),
  { name: 'avatar: no body', method: 'POST', path: `${P}/avatar`, opts: { raw: '', contentType: 'image/png' } },
  { name: 'avatar: wrong content type (text/plain)', method: 'POST', path: `${P}/avatar`, opts: { raw: 'hello', contentType: 'text/plain' } },
  { name: 'avatar: gif not allowed', method: 'POST', path: `${P}/avatar`, opts: { raw: png, contentType: 'image/gif' }, status: 415, code: 'AVATAR_UNSUPPORTED_TYPE' },
  { name: 'avatar: png header but not an image', method: 'POST', path: `${P}/avatar`, opts: { raw: 'this is not a png file at all', contentType: 'image/png' }, status: 415, code: 'AVATAR_UNSUPPORTED_TYPE' },
  { name: 'avatar: > 2 MB -> 413', method: 'POST', path: `${P}/avatar`, opts: { raw: Buffer.alloc(2 * 1024 * 1024 + 2, 1), contentType: 'image/png' }, status: 413 },
  send('PATCH', 'preferences: empty body', '/customer/preferences', {}),
  send('PATCH', 'preferences: language fr', '/customer/preferences', { language: 'fr' }),
  send('PATCH', 'preferences: unknown topic', '/customer/preferences', { notifications: { bogus: { push: true } } }),
  send('PATCH', 'preferences: unknown channel', '/customer/preferences', { notifications: { booking: { carrierPigeon: true } } }),
  send('PATCH', 'preferences: channel not boolean', '/customer/preferences', { notifications: { booking: { push: 'yes' } } }),
  send('PATCH', 'preferences: unknown top-level key', '/customer/preferences', { language: 'en', admin: true }),
  get('preferences GET unknown param', '/customer/preferences?foo=1'),
]);
