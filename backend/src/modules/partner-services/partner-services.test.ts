import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { partnerServicesRepository: repo } = require('./partner-services.repository') as typeof import('./partner-services.repository');
/* eslint-enable @typescript-eslint/no-require-imports */

type AreaDoc = import('./partner-services.repository').AreaDoc;
type PartnerRow = import('./partner-services.repository').PartnerRow;

const partnerUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId();
const approvedA = new Types.ObjectId();
const approvedB = new Types.ObjectId();
const inactive = new Types.ObjectId();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let partner: PartnerRow;
let area: AreaDoc | null;
let server: Server;
let base: string;

const call = (method: string, path: string, bearer?: string, body?: unknown) =>
  fetch(`${base}/api/v1/partner/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as { data: Record<string, unknown>; code?: string; details?: { message: string }[] };

const validArea = {
  baseLocation: { lat: 16.7107, lng: 81.0952, label: 'Eluru' },
  cities: ['Eluru', 'eluru', 'Vijayawada'],
  areas: ['Powerpet'],
  radiusKm: 25,
};

describe('partner services & service area', () => {
  before(() => {
    repo.findPartnerByUserId = (async (id: string) => (id === partnerUserId ? partner : null)) as unknown as typeof repo.findPartnerByUserId;
    repo.listApproved = (async () => [
      { _id: approvedA, name: 'AC Repair', slug: 'ac-repair', categoryId: new Types.ObjectId(), icon: 'ac' },
      { _id: approvedB, name: 'Refrigerator Repair', slug: 'fridge', categoryId: new Types.ObjectId() },
    ]) as unknown as typeof repo.listApproved;
    repo.findApprovedByIds = (async (ids: string[]) =>
      [approvedA, approvedB].filter((o) => ids.includes(o.toString())).map((_id) => ({ _id }))) as unknown as typeof repo.findApprovedByIds;
    repo.saveServices = (async (_pid: Types.ObjectId, ids: string[]) => {
      partner.services = ids.map((i) => new Types.ObjectId(i));
    }) as unknown as typeof repo.saveServices;
    repo.findArea = (async () => area) as unknown as typeof repo.findArea;
    repo.saveArea = (async (pid, body) => {
      area = { partnerId: pid, ...body, updatedAt: new Date() };
      partner.serviceRadiusKm = body.radiusKm;
      return area;
    }) as typeof repo.saveArea;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    partner = { _id: partnerId, services: [], serviceRadiusKm: 10 };
    area = null;
  });

  describe('GET/PATCH /partner/services', () => {
    it('lists approved services with nothing selected', async () => {
      const res = await call('GET', 'services', token('partner'));
      assert.equal(res.status, 200);
      const { data } = await json(res);
      assert.equal((data.approved as unknown[]).length, 2);
      assert.deepEqual(data.selectedIds, []);
    });

    it('saves approved services and de-duplicates ids', async () => {
      const res = await call('PATCH', 'services', token('partner'), {
        serviceIds: [approvedA.toString(), approvedA.toString().toUpperCase()],
      });
      assert.equal(res.status, 200);
      assert.deepEqual((await json(res)).data.selectedIds, [approvedA.toString()]);
    });

    it('rejects an unapproved (inactive or unknown) service', async () => {
      const res = await call('PATCH', 'services', token('partner'), { serviceIds: [approvedA.toString(), inactive.toString()] });
      assert.equal(res.status, 400);
      const body = await json(res);
      assert.equal(body.code, 'VALIDATION_ERROR');
      assert.match(body.details?.[0]?.message ?? '', /not platform-approved/);
      assert.deepEqual(partner.services, []);
    });

    it('rejects a missing field, bad id and extra keys', async () => {
      assert.equal((await call('PATCH', 'services', token('partner'), {})).status, 400);
      assert.equal((await call('PATCH', 'services', token('partner'), { serviceIds: ['nope'] })).status, 400);
      assert.equal((await call('PATCH', 'services', token('partner'), { serviceIds: [], partnerId: 'x' })).status, 400);
    });

    it('requires a token and the partner role', async () => {
      assert.equal((await call('GET', 'services')).status, 401);
      assert.equal((await call('PATCH', 'services', undefined, { serviceIds: [] })).status, 401);
      assert.equal((await call('GET', 'services', token('customer'))).status, 403);
      assert.equal((await call('PATCH', 'services', token('customer'), { serviceIds: [] })).status, 403);
    });

    it("never touches another partner's data: the id comes from the token, a body id is refused", async () => {
      const other = new Types.ObjectId().toString();
      assert.equal((await call('GET', 'services', token('partner', other))).status, 404);
      assert.equal((await call('PATCH', 'services', token('partner'), { serviceIds: [], userId: other })).status, 400);
    });
  });

  describe('GET/PATCH /partner/service-area', () => {
    it('returns an unconfigured default before anything is saved', async () => {
      const { data } = await json(await call('GET', 'service-area', token('partner')));
      assert.equal(data.configured, false);
      assert.equal(data.baseLocation, null);
      assert.equal(data.radiusKm, 10);
    });

    it('saves a valid area, de-duplicates cities and mirrors the radius onto the partner', async () => {
      const res = await call('PATCH', 'service-area', token('partner'), validArea);
      assert.equal(res.status, 200);
      const { data } = await json(res);
      assert.deepEqual(data.cities, ['Eluru', 'Vijayawada']);
      assert.equal(data.radiusKm, 25);
      assert.equal(data.configured, true);
      assert.equal(partner.serviceRadiusKm, 25);
      assert.equal((await json(await call('GET', 'service-area', token('partner')))).data.radiusKm, 25);
    });

    it('validates radius 1-50 (whole numbers)', async () => {
      for (const radiusKm of [0, 51, -3, 2.5, '10']) {
        const res = await call('PATCH', 'service-area', token('partner'), { ...validArea, radiusKm });
        assert.equal(res.status, 400, `radiusKm=${String(radiusKm)}`);
      }
      for (const radiusKm of [1, 50]) {
        assert.equal((await call('PATCH', 'service-area', token('partner'), { ...validArea, radiusKm })).status, 200);
      }
    });

    it('validates base location and cities', async () => {
      const bad = [
        { ...validArea, baseLocation: { lat: 95, lng: 81 } },
        { ...validArea, baseLocation: { lat: 16, lng: 200 } },
        { ...validArea, baseLocation: { lat: 16 } },
        { ...validArea, cities: [] },
        { ...validArea, cities: ['x'] },
      ];
      for (const body of bad) assert.equal((await call('PATCH', 'service-area', token('partner'), body)).status, 400);
    });

    it('rejects missing required fields', async () => {
      for (const key of ['baseLocation', 'cities', 'radiusKm'] as const) {
        const body: Record<string, unknown> = { ...validArea };
        delete body[key];
        assert.equal((await call('PATCH', 'service-area', token('partner'), body)).status, 400, key);
      }
    });

    it('requires a token and the partner role, and ignores no body id', async () => {
      assert.equal((await call('GET', 'service-area')).status, 401);
      assert.equal((await call('PATCH', 'service-area', undefined, validArea)).status, 401);
      assert.equal((await call('PATCH', 'service-area', token('customer'), validArea)).status, 403);
      assert.equal((await call('PATCH', 'service-area', token('partner'), { ...validArea, partnerId: 'x' })).status, 400);
      assert.equal((await call('GET', 'service-area', token('partner', new Types.ObjectId().toString()))).status, 404);
    });
  });
});
