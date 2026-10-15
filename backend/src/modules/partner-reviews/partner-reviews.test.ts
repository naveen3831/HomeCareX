import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { Aggregator } from 'mingo';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const { errorHandler } = require('../../middleware/error.middleware') as typeof import('../../middleware/error.middleware');
const { partnerReviewsRoutes } = require('./partner-reviews.routes') as typeof import('./partner-reviews.routes');
const { partnerReviewsRepository: repo, partnerReviewFilter, partnerStarCountPipeline, PARTNER_REVIEW_SORT } =
  require('./partner-reviews.repository') as typeof import('./partner-reviews.repository');
/* eslint-enable @typescript-eslint/no-require-imports */

const oid = () => new Types.ObjectId();
const partnerUserId = oid().toString();
const otherUserId = oid().toString();
const emptyUserId = oid().toString();
const noProfileUserId = oid().toString();
const partnerId = oid();
const otherPartnerId = oid();
const emptyPartnerId = oid();
const SVC = oid();
const BOOKING_A = oid();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

interface Doc {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  rating: number;
  message?: string;
  customerName: string;
  customerEmail: string;
  tags: string[];
  verified: boolean;
  status: string;
  visible?: boolean;
  serviceId?: Types.ObjectId;
  bookingId?: Types.ObjectId;
  createdAt: Date;
}

const T0 = Date.UTC(2026, 9, 1);
let n = 0;
const doc = (over: Partial<Doc>): Doc => {
  n += 1;
  return {
    _id: oid(),
    partnerId,
    rating: 5,
    message: `Great job number ${n}`,
    customerName: 'Ravi Kumar',
    customerEmail: `secret${n}@example.com`,
    tags: ['On time'],
    verified: true,
    status: 'approved',
    visible: true,
    serviceId: SVC,
    createdAt: new Date(T0 + n * 1000),
    ...over,
  };
};

const docs: Doc[] = [
  // counted for `partnerId`: ratings 5,5,4,4,2 (one is pending, which still counts) = 5 reviews
  doc({ rating: 5, bookingId: BOOKING_A, customerName: 'Ananya Rao' }),
  doc({ rating: 5, customerName: 'Meera' }),
  doc({ rating: 4, customerName: '  Vikram   Singh  ' }),
  doc({ rating: 4, status: 'pending' }),
  doc({ rating: 2, visible: undefined, customerName: 'Rohit Kumar Verma' }), // legacy row with no `visible` field still counts
  // must never be counted or listed for `partnerId`
  doc({ rating: 1, visible: false }), // hidden by an admin
  doc({ rating: 1, status: 'rejected' }),
  doc({ rating: 1, partnerId: otherPartnerId }), // another partner's review
  doc({ rating: 3, partnerId: otherPartnerId }),
];

const run = (stages: Record<string, unknown>[]) => new Aggregator(stages).run(docs) as unknown as Doc[];

let server: Server;
let base: string;
const get = (path: string, bearer?: string) =>
  fetch(`${base}/api/v1/partner/reviews${path}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const body = async <T>(res: Response) => (await res.json()) as T;

describe('GET /partner/reviews and /summary', () => {
  before(() => {
    repo.findPartnerByUserId = (async (userId: string) =>
      userId === partnerUserId
        ? { _id: partnerId }
        : userId === otherUserId
          ? { _id: otherPartnerId }
          : userId === emptyUserId
            ? { _id: emptyPartnerId }
            : null) as unknown as typeof repo.findPartnerByUserId;
    // These run the repository's REAL filter / sort / pipeline over the in-memory docs through mingo.
    repo.countVisible = (async (pid: Types.ObjectId) => run([{ $match: partnerReviewFilter(pid) }]).length) as typeof repo.countVisible;
    repo.findVisible = (async (pid: Types.ObjectId, skip: number, limit: number) =>
      run([{ $match: partnerReviewFilter(pid) }, { $sort: PARTNER_REVIEW_SORT }, { $skip: skip }, { $limit: limit }])) as unknown as typeof repo.findVisible;
    repo.starCounts = (async (pid: Types.ObjectId) =>
      new Map(run(partnerStarCountPipeline(pid)).map((r) => [(r as unknown as { _id: number })._id, (r as unknown as { count: number }).count]))) as typeof repo.starCounts;
    repo.serviceNamesByBooking = (async () => new Map([[String(BOOKING_A), 'Deep Home Cleaning']])) as typeof repo.serviceNamesByBooking;
    repo.serviceNamesById = (async () => new Map([[String(SVC), 'AC Repair']])) as typeof repo.serviceNamesById;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/partner/reviews', partnerReviewsRoutes);
    app.use(errorHandler);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('summary: only the partner\'s non-hidden, non-rejected reviews; distribution adds up and is zero-filled', async () => {
    const res = await get('/summary', token('partner'));
    assert.equal(res.status, 200);
    const { data } = await body<{ data: { average: number; count: number; distribution: Record<string, number> } }>(res);
    assert.equal(data.count, 5);
    assert.deepEqual(data.distribution, { '1': 0, '2': 1, '3': 0, '4': 2, '5': 2 });
    assert.equal(Object.values(data.distribution).reduce((a, b) => a + b, 0), data.count);
    assert.equal(data.average, 4); // (5+5+4+4+2)/5 = 4.0
  });

  it('summary: a partner with no reviews gets zeros, not an error', async () => {
    const res = await get('/summary', token('partner', emptyUserId));
    assert.equal(res.status, 200);
    const { data } = await body<{ data: { average: number; count: number; distribution: Record<string, number> } }>(res);
    assert.equal(data.count, 0);
    assert.equal(data.average, 0);
    assert.deepEqual(data.distribution, { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  });

  it('list: hidden and rejected reviews are excluded, newest first, with customer / service / date', async () => {
    const res = await get('', token('partner'));
    assert.equal(res.status, 200);
    const json = await body<{
      data: Array<{ id: string; rating: number; customer: string; service: string | null; createdAt: string; comment: string }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(res);
    assert.equal(json.data.length, 5);
    assert.equal(json.meta.total, 5);
    assert.ok(json.data.every((r) => r.rating >= 2), 'a hidden or rejected 1-star review leaked into the list');
    const times = json.data.map((r) => r.createdAt);
    assert.deepEqual(times, [...times].sort().reverse());
    const byCustomer = Object.fromEntries(json.data.map((r) => [r.customer, r.service]));
    assert.equal(byCustomer['Ananya R.'], 'Deep Home Cleaning'); // booking snapshot wins
    assert.equal(byCustomer['Meera'], 'AC Repair'); // no booking: falls back to the service record
    assert.ok(json.data.some((r) => r.customer === 'Vikram S.'), 'name is trimmed and shortened');
  });

  it('list: never exposes email or customer id', async () => {
    const text = await (await get('', token('partner'))).text();
    assert.ok(!text.includes('@example.com'));
    assert.ok(!/customerEmail|customerId/.test(text));
  });

  it('list: pagination returns each review exactly once across pages', async () => {
    const p1 = await body<{ data: Array<{ id: string }>; meta: { total: number; totalPages: number } }>(await get('?page=1&limit=2', token('partner')));
    const p2 = await body<{ data: Array<{ id: string }> }>(await get('?page=2&limit=2', token('partner')));
    const p3 = await body<{ data: Array<{ id: string }> }>(await get('?page=3&limit=2', token('partner')));
    const p4 = await body<{ data: Array<{ id: string }> }>(await get('?page=4&limit=2', token('partner')));
    assert.equal(p1.meta.total, 5);
    assert.equal(p1.meta.totalPages, 3);
    assert.deepEqual([p1.data.length, p2.data.length, p3.data.length, p4.data.length], [2, 2, 1, 0]);
    const ids = [...p1.data, ...p2.data, ...p3.data].map((r) => r.id);
    assert.equal(new Set(ids).size, 5);
  });

  it('list: ownership. The other partner sees only their own reviews', async () => {
    const { data, meta } = await body<{ data: Array<{ rating: number }>; meta: { total: number } }>(await get('', token('partner', otherUserId)));
    assert.equal(meta.total, 2);
    assert.deepEqual(data.map((r) => r.rating).sort(), [1, 3]);
  });

  it('401: no token', async () => {
    assert.equal((await get('')).status, 401);
    assert.equal((await get('/summary')).status, 401);
  });

  it('403: customer role (wrong role)', async () => {
    assert.equal((await get('', token('customer'))).status, 403);
    assert.equal((await get('/summary', token('customer'))).status, 403);
  });

  it('403 RESOURCE_FORBIDDEN: another partner\'s id', async () => {
    for (const path of ['', '/summary']) {
      const res = await get(`${path}?partnerId=${otherPartnerId.toString()}`, token('partner'));
      assert.equal(res.status, 403);
      assert.equal((await body<{ code: string }>(res)).code, 'RESOURCE_FORBIDDEN');
    }
  });

  it('200: own partnerId is accepted', async () => {
    assert.equal((await get(`/summary?partnerId=${partnerId.toString()}`, token('partner'))).status, 200);
  });

  it('404 PARTNER_NOT_FOUND: partner account with no profile', async () => {
    const res = await get('/summary', token('partner', noProfileUserId));
    assert.equal(res.status, 404);
    assert.equal((await body<{ code: string }>(res)).code, 'PARTNER_NOT_FOUND');
  });

  it('400: bad query values and unknown fields', async () => {
    for (const q of ['?page=0', '?page=abc', '?limit=0', '?limit=51', '?limit=2.5', '?foo=bar', '?partnerId=nope']) {
      assert.equal((await get(q, token('partner'))).status, 400, q);
    }
    assert.equal((await get('/summary?foo=bar', token('partner'))).status, 400);
  });

  it('200: a blank ?page= is treated as not sent', async () => {
    assert.equal((await get('?page=&limit=', token('partner'))).status, 200);
  });
});
