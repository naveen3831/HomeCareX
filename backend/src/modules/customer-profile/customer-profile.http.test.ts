import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import { customerProfileRepository } from './customer-profile.repository';
import { customerPreferencesRoutes, customerProfileRoutes } from './customer-profile.routes';
import type { ProfileDoc } from './customer-profile.types';

/* The real routes, auth, validation and error handler over HTTP; only the database is swapped for a Map. */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();
const PARTNER = new Types.ObjectId().toString();
const tokenFor = (sub: string, role = 'customer') => jwt.sign({ sub, role }, secret, { expiresIn: '5m' });

const users = new Map<string, ProfileDoc>();
const original = { ...customerProfileRepository };
let base = '';
let close: () => Promise<void>;

before(async () => {
  users.set(A, { _id: A, name: 'Asha', email: 'asha@x.com', phone: '9876543210', role: 'customer' });
  users.set(B, { _id: B, name: 'Bala', email: 'bala@x.com', phone: '9123456780', role: 'customer' });
  Object.assign(customerProfileRepository, {
    findById: async (id: string) => users.get(id) ?? null,
    findByEmail: async (email: string) => [...users.values()].find((u) => u.email === email) ?? null,
    findByPhone: async (phone: string) => [...users.values()].find((u) => u.phone === phone) ?? null,
    update: async (id: string, upd: { $set?: Record<string, unknown>; $unset?: Record<string, ''> }) => {
      const u = users.get(id);
      if (!u) return null;
      Object.assign(u, upd.$set ?? {});
      for (const k of Object.keys(upd.$unset ?? {})) delete (u as unknown as Record<string, unknown>)[k];
      return u;
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/customer/profile', customerProfileRoutes);
  app.use('/api/v1/customer/preferences', customerPreferencesRoutes);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/customer`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(async () => {
  Object.assign(customerProfileRepository, original);
  await close();
});

type Body = { success: boolean; code?: string; message?: string; data?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, opts: { token?: string; json?: unknown; raw?: Uint8Array; type?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | Uint8Array | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (opts.raw) {
    headers['Content-Type'] = opts.type ?? 'image/png';
    body = opts.raw;
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  return { status: res.status, body: (await res.json()) as Body };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)]);

describe('auth and role', () => {
  for (const [method, path, json] of [['GET', '/profile', undefined], ['PATCH', '/profile', { name: 'Zed Zed' }], ['POST', '/profile/avatar', undefined], ['GET', '/preferences', undefined]] as const) {
    test(`${method} ${path}: no token -> 401`, async () => {
      const r = await call(method, path, { json });
      assert.equal(r.status, 401);
      assert.equal(r.body.success, false);
    });
    test(`${method} ${path}: partner token -> 403`, async () => {
      const r = await call(method, path, { token: tokenFor(PARTNER, 'partner'), json });
      assert.equal(r.status, 403);
    });
  }
});

describe('GET / PATCH /customer/profile', () => {
  test('each customer sees only their own profile (id comes from the token)', async () => {
    assert.equal((await call('GET', '/profile', { token: tokenFor(A) })).body.data?.profile.email, 'asha@x.com');
    assert.equal((await call('GET', '/profile', { token: tokenFor(B) })).body.data?.profile.email, 'bala@x.com');
  });

  test('a body naming another user\'s id or a role is refused, nothing changes', async () => {
    const r = await call('PATCH', '/profile', { token: tokenFor(A), json: { id: B, role: 'admin', name: 'Hacked' } });
    assert.equal(r.status, 400);
    assert.equal(users.get(B)?.name, 'Bala');
    assert.equal(users.get(A)?.name, 'Asha');
  });

  test('missing fields / invalid data -> 400 VALIDATION_ERROR', async () => {
    for (const json of [{}, { name: 'A' }, { email: 'nope' }, { phone: '123' }]) {
      const r = await call('PATCH', '/profile', { token: tokenFor(A), json });
      assert.equal(r.status, 400, JSON.stringify(json));
      assert.equal(r.body.code, 'VALIDATION_ERROR');
    }
  });

  test('email taken by another account -> 409', async () => {
    const r = await call('PATCH', '/profile', { token: tokenFor(A), json: { email: 'BALA@x.com' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'EMAIL_ALREADY_EXISTS');
  });

  test('phone taken by another account -> 409', async () => {
    const r = await call('PATCH', '/profile', { token: tokenFor(A), json: { phone: '+91 91234 56780' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PHONE_ALREADY_EXISTS');
  });

  test('a valid edit returns 200 and persists', async () => {
    const r = await call('PATCH', '/profile', { token: tokenFor(A), json: { name: 'Asha Kumar', phone: '9000000001' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.data?.profile.name, 'Asha Kumar');
    assert.equal((await call('GET', '/profile', { token: tokenFor(A) })).body.data?.profile.phone, '9000000001');
  });
});

describe('POST /customer/profile/avatar', () => {
  test('a png is stored and returned as the avatar', async () => {
    const r = await call('POST', '/profile/avatar', { token: tokenFor(A), raw: PNG, type: 'image/png' });
    assert.equal(r.status, 200);
    assert.match(String(r.body.data?.profile.avatarUrl), /^data:image\/png;base64,/);
  });

  test('over 2 MB -> 413', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 10);
    big.set(PNG);
    const r = await call('POST', '/profile/avatar', { token: tokenFor(A), raw: big });
    assert.equal(r.status, 413);
  });

  test('not an image (wrong content) -> 415', async () => {
    const r = await call('POST', '/profile/avatar', { token: tokenFor(A), raw: new TextEncoder().encode('just some text, not an image'), type: 'image/png' });
    assert.equal(r.status, 415);
    assert.equal(r.body.code, 'AVATAR_UNSUPPORTED_TYPE');
  });

  test('no file -> 400', async () => {
    const r = await call('POST', '/profile/avatar', { token: tokenFor(A), raw: new Uint8Array(0) });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'AVATAR_REQUIRED');
  });

  test('DELETE removes it', async () => {
    const r = await call('DELETE', '/profile/avatar', { token: tokenFor(A) });
    assert.equal(r.status, 200);
    assert.equal(r.body.data?.profile.avatarUrl, undefined);
  });
});

describe('GET / PATCH /customer/preferences', () => {
  test('defaults, then a partial update persists', async () => {
    const first = await call('GET', '/preferences', { token: tokenFor(B) });
    assert.equal(first.body.data?.preferences.language, 'en');
    const r = await call('PATCH', '/preferences', { token: tokenFor(B), json: { language: 'te', notifications: { offers: { sms: true } } } });
    assert.equal(r.status, 200);
    const again = await call('GET', '/preferences', { token: tokenFor(B) });
    assert.equal(again.body.data?.preferences.language, 'te');
    assert.equal(again.body.data?.preferences.notifications.offers.sms, true);
    assert.equal((await call('GET', '/preferences', { token: tokenFor(A) })).body.data?.preferences.language, 'en');
  });

  test('invalid language / unknown channel / empty body -> 400', async () => {
    for (const json of [{ language: 'fr' }, { notifications: { booking: { fax: true } } }, {}]) {
      assert.equal((await call('PATCH', '/preferences', { token: tokenFor(B), json })).status, 400, JSON.stringify(json));
    }
  });
});
