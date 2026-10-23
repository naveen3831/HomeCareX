import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import { AppError } from '../../utils/AppError';
import { addressesService } from './addresses.service';
import { addressesRoutes, serviceabilityRoutes } from './addresses.routes';

/* The real routes, auth, validation and error handler over HTTP; only the service (database) is swapped for a Map. */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();
const PARTNER = new Types.ObjectId().toString();
const tokenFor = (sub: string, role = 'customer') => jwt.sign({ sub, role }, secret, { expiresIn: '5m' });

type Stored = { id: string; owner: string; city: string; pincode: string };
const store = new Map<string, Stored>();
let serviceCalls = 0;
const original = { ...(addressesService as unknown as Record<string, unknown>) };
let base = '';
let close: () => Promise<void>;

const valid = { label: 'Home', house: '12-3', street: 'Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500081' };

before(async () => {
  Object.assign(addressesService, {
    list: async (owner: string) => {
      serviceCalls += 1;
      return [...store.values()].filter((a) => a.owner === owner);
    },
    create: async (owner: string, body: { city: string; pincode: string }) => {
      serviceCalls += 1;
      const a = { id: new Types.ObjectId().toString(), owner, city: body.city, pincode: body.pincode };
      store.set(a.id, a);
      return a;
    },
    update: async (owner: string, id: string, patch: Partial<Stored>) => {
      serviceCalls += 1;
      const a = store.get(id);
      if (!a || a.owner !== owner) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'That address was not found');
      Object.assign(a, patch);
      return a;
    },
    remove: async (owner: string, id: string) => {
      serviceCalls += 1;
      const a = store.get(id);
      if (!a || a.owner !== owner) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'That address was not found');
      store.delete(id);
    },
    checkServiceability: async (pincode: string) => {
      serviceCalls += 1;
      return { serviceable: pincode === '500081', pincode };
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/addresses', addressesRoutes);
  app.use('/api/v1/serviceability', serviceabilityRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(async () => {
  Object.assign(addressesService, original);
  await close();
});
beforeEach(() => {
  store.clear();
  serviceCalls = 0;
});

type Body = { success: boolean; code?: string; message?: string; data?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, opts: { token?: string; json?: unknown; rawBody?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = opts.rawBody;
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  return { status: res.status, body: (await res.json()) as Body };
}
const mine = (token = tokenFor(A)) => ({ token });

async function seed(owner: string) {
  const r = await call('POST', '/addresses', { token: tokenFor(owner), json: valid });
  assert.equal(r.status, 201);
  return r.body.data!.address.id as string;
}

describe('auth and role', () => {
  const some = new Types.ObjectId().toString();
  const cases: Array<[string, string, unknown]> = [
    ['GET', '/addresses', undefined],
    ['POST', '/addresses', valid],
    ['PATCH', `/addresses/${some}`, { city: 'Pune' }],
    ['DELETE', `/addresses/${some}`, undefined],
    ['GET', '/serviceability?pincode=500081', undefined],
    ['GET', '/addresses/serviceability?pincode=500081', undefined],
  ];
  for (const [method, path, json] of cases) {
    test(`${method} ${path.split('?')[0].replace(some, ':id')}: no token -> 401`, async () => {
      const r = await call(method, path, { json });
      assert.equal(r.status, 401);
      assert.equal(r.body.success, false);
      assert.equal(serviceCalls, 0);
    });
    test(`${method} ${path.split('?')[0].replace(some, ':id')}: invalid token -> 401`, async () => {
      const r = await call(method, path, { token: 'not-a-real-token', json });
      assert.equal(r.status, 401);
      assert.equal(serviceCalls, 0);
    });
    test(`${method} ${path.split('?')[0].replace(some, ':id')}: partner token -> 403`, async () => {
      const r = await call(method, path, { token: tokenFor(PARTNER, 'partner'), json });
      assert.equal(r.status, 403);
      assert.equal(serviceCalls, 0);
    });
  }
  test('an expired token -> 401', async () => {
    const expired = jwt.sign({ sub: A, role: 'customer' }, secret, { expiresIn: -10 });
    const r = await call('GET', '/addresses', { token: expired });
    assert.equal(r.status, 401);
  });
});

describe('POST /addresses: invalid body -> 400 and nothing is saved', () => {
  const bad: Array<[string, unknown]> = [
    ['empty body', {}],
    ['missing city', { ...valid, city: undefined }],
    ['missing state', { ...valid, state: undefined }],
    ['missing pincode', { ...valid, pincode: undefined }],
    ['house without street', { label: 'Home', house: '12-3', city: 'Hyderabad', state: 'Telangana', pincode: '500081' }],
    ['blank city', { ...valid, city: '   ' }],
    ['5-digit pincode', { ...valid, pincode: '50008' }],
    ['7-digit pincode', { ...valid, pincode: '5000812' }],
    ['letters in pincode', { ...valid, pincode: '50008A' }],
    ['pincode as a number', { ...valid, pincode: 500081 }],
    ['unknown label', { ...valid, label: 'Office' }],
    ['latitude out of range', { ...valid, location: { lat: 95, lng: 78 } }],
    ['longitude out of range', { ...valid, location: { lat: 17, lng: 190 } }],
    ['isDefault is not a boolean', { ...valid, isDefault: 'yes' }],
    ['unknown field', { ...valid, role: 'admin' }],
    ['someone else as owner', { ...valid, customerId: B }],
    ['house too long', { ...valid, house: 'x'.repeat(101) }],
  ];
  for (const [name, json] of bad) {
    test(name, async () => {
      const r = await call('POST', '/addresses', { ...mine(), json });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(r.body.success, false);
      assert.equal(r.body.code, 'VALIDATION_ERROR');
      assert.equal(serviceCalls, 0);
      assert.equal(store.size, 0);
    });
  }
  test('malformed JSON -> 400', async () => {
    const r = await call('POST', '/addresses', { ...mine(), rawBody: '{"city": ' });
    assert.equal(r.status, 400);
    assert.equal(r.body.success, false);
    assert.equal(serviceCalls, 0);
  });
});

describe('PATCH and DELETE /addresses/:id: invalid input', () => {
  for (const id of ['abc', '123', 'not-an-object-id', '507f1f77bcf86cd79943901']) {
    test(`PATCH with bad id "${id}" -> 400`, async () => {
      const r = await call('PATCH', `/addresses/${id}`, { ...mine(), json: { city: 'Pune' } });
      assert.equal(r.status, 400);
      assert.equal(r.body.code, 'VALIDATION_ERROR');
      assert.equal(serviceCalls, 0);
    });
    test(`DELETE with bad id "${id}" -> 400`, async () => {
      const r = await call('DELETE', `/addresses/${id}`, mine());
      assert.equal(r.status, 400);
      assert.equal(serviceCalls, 0);
    });
  }
  const badPatch: Array<[string, unknown]> = [
    ['empty body', {}],
    ['5-digit pincode', { pincode: '50008' }],
    ['unknown label', { label: 'Office' }],
    ['unknown field', { owner: B }],
    ['blank city', { city: '' }],
    ['isDefault is not a boolean', { isDefault: 'true' }],
  ];
  for (const [name, json] of badPatch) {
    test(`PATCH ${name} -> 400`, async () => {
      const id = await seed(A);
      serviceCalls = 0;
      const r = await call('PATCH', `/addresses/${id}`, { ...mine(), json });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(r.body.code, 'VALIDATION_ERROR');
      assert.equal(serviceCalls, 0);
      assert.equal(store.get(id)?.city, 'Hyderabad');
    });
  }
});

describe('GET /serviceability: invalid query -> 400', () => {
  for (const q of ['', '?pincode=', '?pincode=5000', '?pincode=5000811', '?pincode=abcdef', '?pincode=50008%201', '?other=500081']) {
    for (const prefix of ['/serviceability', '/addresses/serviceability']) {
      test(`${prefix}${q || ' (no query)'}`, async () => {
        const r = await call('GET', `${prefix}${q}`, mine());
        assert.equal(r.status, 400, JSON.stringify(r.body));
        assert.equal(r.body.code, 'VALIDATION_ERROR');
        assert.equal(serviceCalls, 0);
      });
    }
  }
  test('a valid pincode -> 200', async () => {
    const r = await call('GET', '/serviceability?pincode=500081', mine());
    assert.equal(r.status, 200);
    assert.equal(r.body.data?.serviceable, true);
  });
});

describe('customer isolation (another customer\'s address)', () => {
  test('GET /addresses only returns the caller\'s own addresses', async () => {
    const a = await seed(A);
    const b = await seed(B);
    const r = await call('GET', '/addresses', mine(tokenFor(A).length ? tokenFor(A) : ''));
    assert.equal(r.status, 200);
    const ids = (r.body.data!.addresses as Array<{ id: string }>).map((x) => x.id);
    assert.deepEqual(ids, [a]);
    assert.ok(!ids.includes(b));
  });
  test('PATCH another customer\'s address -> 404 and it is unchanged', async () => {
    const a = await seed(A);
    const r = await call('PATCH', `/addresses/${a}`, { token: tokenFor(B), json: { city: 'Pune' } });
    assert.equal(r.status, 404);
    assert.equal(r.body.code, 'ADDRESS_NOT_FOUND');
    assert.equal(store.get(a)?.city, 'Hyderabad');
  });
  test('DELETE another customer\'s address -> 404 and it still exists', async () => {
    const a = await seed(A);
    const r = await call('DELETE', `/addresses/${a}`, { token: tokenFor(B) });
    assert.equal(r.status, 404);
    assert.ok(store.has(a));
  });
  test('a valid id that does not exist -> 404', async () => {
    const r = await call('PATCH', `/addresses/${new Types.ObjectId().toString()}`, { ...mine(), json: { city: 'Pune' } });
    assert.equal(r.status, 404);
  });
  test('the owner can still edit and delete their own address', async () => {
    const a = await seed(A);
    const p = await call('PATCH', `/addresses/${a}`, { ...mine(), json: { city: 'Warangal' } });
    assert.equal(p.status, 200);
    assert.equal(store.get(a)?.city, 'Warangal');
    const d = await call('DELETE', `/addresses/${a}`, mine());
    assert.equal(d.status, 200);
    assert.ok(!store.has(a));
  });
});
