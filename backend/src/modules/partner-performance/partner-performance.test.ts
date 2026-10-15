import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { partnerPerformanceRepository: repo } = require('./partner-performance.repository') as typeof import('./partner-performance.repository');
const { buildPoint, buildSummary, lastMonths, rate } = require('./partner-performance.calc') as typeof import('./partner-performance.calc');
/* eslint-enable @typescript-eslint/no-require-imports */

const partnerUserId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();
const noProfileUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const otherPartnerId = new Types.ObjectId();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

describe('performance calc', () => {
  it('rate: one decimal, null when nothing to divide by', () => {
    assert.equal(rate(19, 20), 95);
    assert.equal(rate(1, 3), 33.3);
    assert.equal(rate(0, 5), 0);
    assert.equal(rate(0, 0), null);
  });

  it('buildSummary: every metric from the counts, null where there is no data', () => {
    const s = buildSummary(
      { ratingAvg: 4.66, ratingCount: 120 },
      { resolved: 20, completed: 18, cancelledByPartner: 1, withArrival: 18, onTime: 16 },
      { answered: 10, accepted: 8 },
    );
    assert.deepEqual(s, { totalJobs: 20, ratingCount: 120, rating: 4.7, acceptanceRate: 80, completionRate: 90, cancellationRate: 5, onTimeRate: 88.9 });

    const empty = buildSummary({ ratingAvg: 0, ratingCount: 0 }, { resolved: 0, completed: 0, cancelledByPartner: 0, withArrival: 0, onTime: 0 }, { answered: 0, accepted: 0 });
    assert.deepEqual(empty, { totalJobs: 0, ratingCount: 0, rating: null, acceptanceRate: null, completionRate: null, cancellationRate: null, onTimeRate: null });
  });

  it('buildPoint: no rating stat means null rating', () => {
    const p = buildPoint('2026-10', { resolved: 4, completed: 4, cancelledByPartner: 0, withArrival: 3, onTime: 3 }, { answered: 0, accepted: 0 }, undefined);
    assert.deepEqual(p, { period: '2026-10', rating: null, acceptanceRate: null, completionRate: 100, cancellationRate: 0, onTimeRate: 100 });
  });

  it('lastMonths: oldest first, crosses the year boundary, uses business time', () => {
    assert.deepEqual(lastMonths(new Date('2026-02-10T00:00:00Z'), 4, 330), ['2025-11', '2025-12', '2026-01', '2026-02']);
    // 2026-09-30 20:00 UTC is already 1 Oct in IST (+05:30)
    assert.equal(lastMonths(new Date('2026-09-30T20:00:00Z'), 1, 330)[0], '2026-10');
  });
});

let server: Server;
let base: string;
const get = (path: string, bearer?: string) => fetch(`${base}/api/v1/partner/performance${path}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const code = async (res: Response) => ((await res.json()) as { code: string }).code;

describe('GET /partner/performance and /trends', () => {
  before(() => {
    repo.findPartnerByUserId = (async (userId: string) =>
      userId === partnerUserId
        ? { _id: partnerId, ratingAvg: 4.7, ratingCount: 120 }
        : userId === otherUserId
          ? { _id: otherPartnerId, ratingAvg: 3, ratingCount: 1 }
          : null) as unknown as typeof repo.findPartnerByUserId;
    // Only this partner has data; asking for anyone else's counts would return nothing.
    repo.jobCounts = (async (pid: Types.ObjectId, by: string) =>
      pid.equals(partnerId)
        ? new Map([[by === 'all' ? 'all' : '2026-10', { resolved: 20, completed: 18, cancelledByPartner: 1, withArrival: 18, onTime: 16 }]])
        : new Map()) as unknown as typeof repo.jobCounts;
    repo.offerCounts = (async (pid: Types.ObjectId, by: string) =>
      pid.equals(partnerId) ? new Map([[by === 'all' ? 'all' : '2026-10', { answered: 10, accepted: 8 }]]) : new Map()) as unknown as typeof repo.offerCounts;
    repo.monthlyRatings = (async () => new Map([['2026-10', { avg: 4.5, count: 3 }]])) as unknown as typeof repo.monthlyRatings;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('200: summary matches the partner\'s own data', async () => {
    const res = await get('', token('partner'));
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as { data: Record<string, unknown> };
    assert.deepEqual(data, { totalJobs: 20, ratingCount: 120, rating: 4.7, acceptanceRate: 80, completionRate: 90, cancellationRate: 5, onTimeRate: 88.9 });
  });

  it('200: summary for a partner with no history is all null, not 0', async () => {
    const res = await get('', token('partner', otherUserId));
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as { data: Record<string, unknown> };
    assert.equal(data.totalJobs, 0);
    assert.equal(data.completionRate, null);
    assert.equal(data.onTimeRate, null);
  });

  it('200: trends has 6 monthly points, oldest first, empty months are null', async () => {
    const res = await get('/trends', token('partner'));
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as { data: { points: Array<{ period: string; completionRate: number | null; rating: number | null }> } };
    assert.equal(data.points.length, 6);
    const periods = data.points.map((p) => p.period);
    assert.deepEqual(periods, [...periods].sort());
    assert.ok(data.points.every((p) => /^\d{4}-\d{2}$/.test(p.period)));
    assert.ok(data.points.some((p) => p.completionRate === null));
  });

  it('401: no token', async () => {
    assert.equal((await get('')).status, 401);
    assert.equal((await get('/trends')).status, 401);
  });

  it('403: customer role', async () => {
    assert.equal((await get('', token('customer'))).status, 403);
    assert.equal((await get('/trends', token('customer'))).status, 403);
  });

  it('403 RESOURCE_FORBIDDEN: another partner\'s id', async () => {
    for (const path of ['', '/trends']) {
      const res = await get(`${path}?partnerId=${otherPartnerId.toString()}`, token('partner'));
      assert.equal(res.status, 403);
      assert.equal(await code(res), 'RESOURCE_FORBIDDEN');
    }
  });

  it('200: own partnerId is accepted', async () => {
    assert.equal((await get(`?partnerId=${partnerId.toString()}`, token('partner'))).status, 200);
  });

  it('400: malformed partnerId or unknown query field', async () => {
    assert.equal((await get('?partnerId=abc', token('partner'))).status, 400);
    assert.equal((await get('?foo=bar', token('partner'))).status, 400);
  });

  it('404 PARTNER_NOT_FOUND: partner user without a profile', async () => {
    const res = await get('', token('partner', noProfileUserId));
    assert.equal(res.status, 404);
    assert.equal(await code(res), 'PARTNER_NOT_FOUND');
  });
});