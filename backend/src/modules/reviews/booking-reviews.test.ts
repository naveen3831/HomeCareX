import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import { PartnerModel } from '../../models/Partner';
import { ReviewModel } from '../../models/Review';
import { UserModel } from '../../models/User';
import { authService } from '../auth/auth.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { ReviewsRepository, reviewsRepository as repo, type BookingForReview, type CustomerReviewRow, type PendingBookingRow } from './reviews.repository';
import { reviewsRoutes } from './reviews.routes';

/*
 * POST /bookings/:id/review, GET /reviews, GET /reviews/pending: run through the real router, auth and role
 * middleware and error handler. Only the database layer is replaced. Token format here: "<role>:<userId>".
 */
const oid = () => new Types.ObjectId();
const CUSTOMER = oid(), OTHER_CUSTOMER = oid(), PARTNER_ID = oid(), SERVICE = oid(), BOOKING = oid();
const bearer = (role: string, id: Types.ObjectId = CUSTOMER) => ({ Authorization: `Bearer ${role}:${id}` });

const origVerify = authService.verifyAccessToken;
const origFindById = UserModel.findById;
const origCreate = ReviewModel.create;
const real = new ReviewsRepository(); // untouched copy of the real methods

let booking: BookingForReview | null;
let hasReview: boolean;
let created: Record<string, unknown> | null;
let createError: unknown;
let followUps: { rated: string[]; recomputed: string[] };
let followUpError: Error | null;
let listedFor: string[];

beforeEach(() => {
  booking = { customerId: CUSTOMER, serviceId: SERVICE, partnerId: PARTNER_ID, status: 'completed' };
  hasReview = false;
  created = null;
  createError = null;
  followUps = { rated: [], recomputed: [] };
  followUpError = null;
  listedFor = [];
});

const app = express();
app.use(express.json());
app.use(reviewsRoutes);
app.use(errorHandler);
let base = '';
let close = () => Promise.resolve();

before(() => {
  authService.verifyAccessToken = ((token: string): AccessTokenPayload => {
    const [role, sub] = token.split(':');
    if (!sub) throw Object.assign(new Error('bad token'), { status: 401 });
    return { sub, role } as AccessTokenPayload;
  }) as never;
  UserModel.findById = (() => ({ select: () => ({ lean: async () => ({ _id: CUSTOMER, name: 'Test Customer', email: 'c@example.com' }) }) })) as never;
  ReviewModel.create = (async (d: Record<string, unknown>) => {
    if (createError) throw createError;
    created = d;
    return { toObject: () => ({ _id: oid(), createdAt: new Date('2026-10-01T10:00:00Z'), status: 'pending', ...d }) };
  }) as never;
  repo.findBookingForReview = (async () => booking) as never;
  repo.bookingHasReview = (async () => hasReview) as never;
  repo.markBookingRated = (async (id: string) => {
    if (followUpError) throw followUpError;
    followUps.rated.push(id);
  }) as never;
  repo.recomputePartnerRating = (async (id: string) => {
    followUps.recomputed.push(id);
    return { ratingAvg: 5, ratingCount: 1 };
  }) as never;
  repo.recomputeServiceRating = (async () => ({ ratingAvg: 5, ratingCount: 1 })) as never;
  repo.serviceNames = (async () => new Map([[String(BOOKING), 'Deep Cleaning']])) as never;
  repo.partnerNames = (async () => new Map([[String(PARTNER_ID), 'Suresh P']])) as never;
  repo.listForCustomer = (async (id: string): Promise<CustomerReviewRow[]> => {
    listedFor.push(id);
    return [{ _id: oid(), bookingId: BOOKING, serviceId: SERVICE, partnerId: PARTNER_ID, rating: 4, message: 'Good work', tags: ['On time'], status: 'approved', visible: true, verified: true, createdAt: new Date('2026-10-02T00:00:00Z') }];
  }) as never;
  repo.listPendingForCustomer = (async (id: string): Promise<PendingBookingRow[]> => {
    listedFor.push(id);
    return [{ _id: BOOKING, serviceId: SERVICE, serviceName: 'Deep Cleaning', partnerId: PARTNER_ID, scheduledAt: new Date('2026-10-01T09:00:00Z') }];
  }) as never;
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});

after(async () => {
  authService.verifyAccessToken = origVerify;
  UserModel.findById = origFindById;
  ReviewModel.create = origCreate;
  // Drop the per-instance stubs so the prototype's real methods are visible again.
  for (const key of Object.keys(repo)) delete (repo as unknown as Record<string, unknown>)[key];
  await close();
});

interface Body { success: boolean; code?: string; message?: string; data?: Record<string, unknown> & unknown[] }
const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Body };
};
const post = (id: string, body: unknown, headers = bearer('customer')) => call('POST', `/bookings/${id}/review`, headers, body);

/* ---------- auth + role ---------- */
test('no token -> 401 on all three customer endpoints', async () => {
  assert.equal((await call('POST', `/bookings/${BOOKING}/review`, {}, { rating: 5 })).status, 401);
  assert.equal((await call('GET', '/reviews')).status, 401);
  assert.equal((await call('GET', '/reviews/pending')).status, 401);
});

test('partner and admin tokens -> 403 (customers only)', async () => {
  for (const role of ['partner', 'admin']) {
    assert.equal((await post(String(BOOKING), { rating: 5 }, bearer(role))).status, 403, role);
    assert.equal((await call('GET', '/reviews', bearer(role))).status, 403, role);
    assert.equal((await call('GET', '/reviews/pending', bearer(role))).status, 403, role);
  }
  assert.equal(created, null);
});

/* ---------- validation ---------- */
test('malformed booking id -> 400 and nothing is written', async () => {
  for (const id of ['nope', '123', '%24ne']) assert.equal((await post(id, { rating: 5 })).status, 400, id);
  assert.equal(created, null);
});

test('rating is required: missing, 0, 6, 3.5, text and null are all 400', async () => {
  const r = await post(String(BOOKING), { comment: 'no stars given' });
  assert.equal(r.status, 400);
  assert.match(r.body.message ?? '', /rating is required/i);
  for (const rating of [0, 6, 3.5, '5', null, -1]) {
    assert.equal((await post(String(BOOKING), { rating })).status, 400, String(rating));
  }
  assert.equal(created, null);
});

test('only the four known tags are accepted; a comment over 2000 chars is rejected', async () => {
  assert.equal((await post(String(BOOKING), { rating: 5, tags: ['Cheap'] })).status, 400);
  assert.equal((await post(String(BOOKING), { rating: 5, tags: 'On time' })).status, 400);
  assert.equal((await post(String(BOOKING), { rating: 5, comment: 'x'.repeat(2001) })).status, 400);
  assert.equal(created, null);
});

/* ---------- ownership + completion + duplicates ---------- */
test('a missing booking and someone else\'s booking give the identical 404 (ids cannot be probed)', async () => {
  booking = null;
  const missing = await post(String(BOOKING), { rating: 5 });
  booking = { customerId: OTHER_CUSTOMER, serviceId: SERVICE, partnerId: PARTNER_ID, status: 'completed' };
  const foreign = await post(String(BOOKING), { rating: 5 });
  assert.equal(missing.status, 404);
  assert.equal(foreign.status, 404);
  assert.deepEqual(foreign.body, missing.body);
  assert.equal(created, null);
});

test('an incomplete booking is rejected with 409 and no review is created', async () => {
  for (const status of ['created', 'searching_for_partner', 'confirmed', 'assigned', 'en_route', 'in_progress', 'cancelled_by_customer', 'disputed']) {
    booking = { customerId: CUSTOMER, serviceId: SERVICE, partnerId: PARTNER_ID, status };
    const r = await post(String(BOOKING), { rating: 5 });
    assert.equal(r.status, 409, status);
    assert.match(r.body.message ?? '', /completed/i);
  }
  assert.equal(created, null);
  assert.deepEqual(followUps, { rated: [], recomputed: [] });
});

test('reviewing the same booking twice -> 409 (checked up front)', async () => {
  hasReview = true;
  const r = await post(String(BOOKING), { rating: 5 });
  assert.equal(r.status, 409);
  assert.match(r.body.message ?? '', /already reviewed/i);
  assert.equal(created, null);
});

test('two taps at once -> the unique bookingId index still turns the second into a 409', async () => {
  createError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  const r = await post(String(BOOKING), { rating: 5 });
  assert.equal(r.status, 409);
  assert.deepEqual(followUps, { rated: [], recomputed: [] });
});

/* ---------- success ---------- */
test('success: 201, links service + partner from the booking, verified, tags de-duplicated, partner rating recomputed', async () => {
  const r = await post(String(BOOKING), { rating: 5, comment: '  Very professional and on time.  ', tags: ['On time', 'Clean work', 'On time'] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(created);
  assert.equal(created.rating, 5);
  assert.equal(created.message, 'Very professional and on time.');
  assert.deepEqual(created.tags, ['On time', 'Clean work']);
  assert.equal(String(created.bookingId), String(BOOKING));
  assert.equal(String(created.serviceId), String(SERVICE));
  assert.equal(String(created.partnerId), String(PARTNER_ID));
  assert.equal(String(created.customerId), String(CUSTOMER));
  assert.equal(created.verified, true);
  assert.deepEqual(followUps, { rated: [String(BOOKING)], recomputed: [String(PARTNER_ID)] });

  const data = r.body.data as unknown as Record<string, unknown>;
  assert.equal(data.rating, 5);
  assert.equal(data.comment, 'Very professional and on time.');
  assert.deepEqual(data.tags, ['On time', 'Clean work']);
  assert.equal(data.serviceName, 'Deep Cleaning');
  assert.equal(data.partnerName, 'Suresh P');
  assert.equal(data.status, 'approved');
  assert.equal(data.visible, true);
  assert.ok(!('customerEmail' in data), 'the customer email must not be echoed');
});

test('only the rating is needed: no comment -> empty comment, no tags', async () => {
  const r = await post(String(BOOKING), { rating: 3 });
  assert.equal(r.status, 201);
  assert.equal(created?.message, undefined);
  assert.deepEqual(created?.tags, []);
  assert.equal((r.body.data as unknown as { comment: string }).comment, '');
});

test('an already-"rated" booking with no review row is still reviewable', async () => {
  booking = { customerId: CUSTOMER, serviceId: SERVICE, partnerId: PARTNER_ID, status: 'rated' };
  assert.equal((await post(String(BOOKING), { rating: 4 })).status, 201);
});

test('the client cannot choose ids, verification or moderation: extra body fields are ignored', async () => {
  const other = oid();
  await post(String(BOOKING), { rating: 5, customerId: String(other), partnerId: String(other), serviceId: String(other), verified: false, status: 'approved', visible: false });
  assert.equal(String(created?.customerId), String(CUSTOMER));
  assert.equal(String(created?.partnerId), String(PARTNER_ID));
  assert.equal(String(created?.serviceId), String(SERVICE));
  assert.equal(created?.verified, true);
  assert.equal(created?.status, undefined);
  assert.equal(created?.visible, undefined);
});

test('a booking without a partner yet saves the review without a partnerId and skips the rating update', async () => {
  booking = { customerId: CUSTOMER, serviceId: SERVICE, partnerId: null, status: 'completed' };
  const r = await post(String(BOOKING), { rating: 4 });
  assert.equal(r.status, 201);
  assert.equal(created?.partnerId, undefined);
  assert.deepEqual(followUps.recomputed, []);
});

test('a failing follow-up (booking/partner update) never turns a saved review into an error', async () => {
  followUpError = new Error('db hiccup');
  const r = await post(String(BOOKING), { rating: 5 });
  assert.equal(r.status, 201);
  assert.ok(created);
});

/* ---------- lists ---------- */
test('GET /reviews returns only the caller\'s reviews, even when ?customerId= is passed', async () => {
  const r = await call('GET', `/reviews?customerId=${OTHER_CUSTOMER}`, bearer('customer'));
  assert.equal(r.status, 200);
  assert.deepEqual(listedFor, [String(CUSTOMER)]);
  const [item] = r.body.data as unknown as Record<string, unknown>[];
  assert.equal(item.comment, 'Good work');
  assert.equal(item.serviceName, 'Deep Cleaning');
  assert.equal(item.partnerName, 'Suresh P');
  assert.ok(!('customerEmail' in item));
});

test('GET /reviews/pending lists completed bookings awaiting a review, scoped to the caller', async () => {
  const r = await call('GET', `/reviews/pending?customerId=${OTHER_CUSTOMER}`, bearer('customer'));
  assert.equal(r.status, 200);
  assert.deepEqual(listedFor, [String(CUSTOMER)]);
  assert.deepEqual(r.body.data, [
    { bookingId: String(BOOKING), serviceId: String(SERVICE), serviceName: 'Deep Cleaning', partnerId: String(PARTNER_ID), partnerName: 'Suresh P', completedOn: '2026-10-01T09:00:00.000Z' },
  ]);
});

/* ---------- partner rating maths (real repository method, stubbed model calls) ---------- */
test('recomputePartnerRating: one-decimal average and count are written to the partner; no reviews -> 0 / 0', async () => {
  const origAgg = ReviewModel.aggregate;
  const origUpdate = PartnerModel.updateOne;
  const writes: unknown[] = [];
  PartnerModel.updateOne = (async (...args: unknown[]) => { writes.push(args); return {}; }) as never;
  try {
    ReviewModel.aggregate = (async () => [{ _id: null, avg: 4.3333, count: 3 }]) as never;
    assert.deepEqual(await real.recomputePartnerRating(String(PARTNER_ID)), { ratingAvg: 4.3, ratingCount: 3 });
    ReviewModel.aggregate = (async () => []) as never;
    assert.deepEqual(await real.recomputePartnerRating(String(PARTNER_ID)), { ratingAvg: 0, ratingCount: 0 });
    assert.equal(writes.length, 2);
    assert.deepEqual((writes[0] as unknown[])[1], { $set: { ratingAvg: 4.3, ratingCount: 3 } });
  } finally {
    ReviewModel.aggregate = origAgg;
    PartnerModel.updateOne = origUpdate;
  }
});
