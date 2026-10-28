import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, describe, mock, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware';
import { HttpError } from '../auth/auth.types';
import { authService } from '../auth/auth.service';
import { partnerSettingsRoutes } from './partner-settings.routes';

/**
 * Day 17 negative suite for D10 (partner settings).
 * Real router, auth, role + permission and validation over HTTP, no database: a body that slips past
 * validation reaches the DB and fails as a 500, so each 400 proves "rejected before any work".
 */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const ME = new Types.ObjectId().toString();
const sign = (role: string, opts: jwt.SignOptions = { expiresIn: '5m' }) => jwt.sign({ sub: ME, role }, secret, opts);
const PARTNER = sign('partner');

let base = '';
let close: () => Promise<void>;

before(async () => {
  mongoose.set('bufferCommands', false);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/partner/settings', partnerSettingsRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(async () => close());
afterEach(() => mock.restoreAll());

async function call(method: string, path: string, opts: { token?: string | null; json?: unknown; raw?: string } = {}) {
  const { token = PARTNER, json, raw } = opts;
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
  const res = await fetch(`${base}/partner/settings${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: { success?: boolean; message?: string; code?: string; data?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text, headers: res.headers };
}

type Case = { name: string; path: string; json?: unknown; raw?: string };

function rejects(title: string, cases: Case[]) {
  describe(title, () => {
    for (const c of cases) {
      test(c.name, async () => {
        const r = await call('PATCH', c.path, { json: c.json, raw: c.raw });
        assert.notEqual(r.status, 500, `bad input reached the database / crashed: ${r.text}`);
        assert.equal(r.status, 400, `PATCH ${c.path} -> ${r.status} ${r.text}`);
        assert.equal(r.body.success, false);
        assert.equal(typeof r.body.message, 'string');
      });
    }
  });
}

/* ---------------- security ---------------- */
describe('security: write routes need the partner role and the settings:write permission', () => {
  for (const path of ['', '/notifications', '/privacy', '/security']) {
    test(`customer token cannot PATCH /partner/settings${path} -> 403`, async () => {
      assert.equal((await call('PATCH', path, { token: sign('customer'), json: { language: 'en' } })).status, 403);
    });
    test(`admin token cannot PATCH /partner/settings${path} -> 403`, async () => {
      assert.equal((await call('PATCH', path, { token: sign('admin'), json: { language: 'en' } })).status, 403);
    });
    test(`expired token cannot PATCH /partner/settings${path} -> 401`, async () => {
      assert.equal((await call('PATCH', path, { token: sign('partner', { expiresIn: -60 }), json: {} })).status, 401);
    });
  }
  test('customer token cannot read sessions -> 403', async () => {
    assert.equal((await call('GET', '/sessions', { token: sign('customer') })).status, 403);
  });
  test('customer token cannot logout-all through the partner route -> 403', async () => {
    assert.equal((await call('POST', '/logout-all', { token: sign('customer') })).status, 403);
  });
});

/* ---------------- validation ---------------- */
rejects('PATCH /partner/settings', [
  { name: 'empty object', path: '', json: {} },
  { name: 'array body', path: '', json: [{ language: 'en' }] },
  { name: 'null body', path: '', json: null },
  { name: 'unsupported language', path: '', json: { language: 'klingon' } },
  { name: 'language as number', path: '', json: { language: 1 } },
  { name: 'language null', path: '', json: { language: null } },
  { name: 'unknown top-level key', path: '', json: { theme: 'dark' } },
  { name: 'role (privilege escalation)', path: '', json: { role: 'admin' } },
  { name: 'userId (reassigning the settings row)', path: '', json: { userId: new Types.ObjectId().toString() } },
  { name: 'email change is not a setting', path: '', json: { email: 'x@y.com' } },
  { name: 'password change is not a setting', path: '', json: { password: 'Passw0rd!' } },
  { name: 'tokenVersion', path: '', json: { tokenVersion: 99 } },
  { name: 'nested: unknown notifications key', path: '', json: { notifications: { fax: true } } },
  { name: 'nested: notifications flag as string', path: '', json: { notifications: { push: 'yes' } } },
  { name: 'nested: empty notifications object', path: '', json: { notifications: {} } },
  { name: 'nested: invalid locationSharing', path: '', json: { privacy: { locationSharing: 'always-on-forever' } } },
  { name: 'nested: security 2FA is not offered yet', path: '', json: { security: { twoFactor: true } } },
  { name: 'nested: __proto__ pollution attempt', path: '', raw: '{"notifications":{"__proto__":{"push":true}}}' },
  { name: 'malformed JSON', path: '', raw: '{"language": ' },
]);

rejects('PATCH /partner/settings/notifications', [
  { name: 'empty object', path: '/notifications', json: {} },
  { name: 'push as string', path: '/notifications', json: { push: 'true' } },
  { name: 'sms as number', path: '/notifications', json: { sms: 1 } },
  { name: 'email null', path: '/notifications', json: { email: null } },
  { name: 'jobAlerts as array', path: '/notifications', json: { jobAlerts: [true] } },
  { name: 'promotions as object (operator injection)', path: '/notifications', json: { promotions: { $ne: false } } },
  { name: 'unknown key', path: '/notifications', json: { push: true, whatsapp: true } },
  { name: 'userId', path: '/notifications', json: { push: true, userId: new Types.ObjectId().toString() } },
  { name: 'array body', path: '/notifications', json: [{ push: true }] },
  { name: 'malformed JSON', path: '/notifications', raw: '{push: true' },
]);

rejects('PATCH /partner/settings/privacy', [
  { name: 'empty object', path: '/privacy', json: {} },
  { name: 'locationSharing not in the list', path: '/privacy', json: { locationSharing: 'everyone' } },
  { name: 'locationSharing as boolean', path: '/privacy', json: { locationSharing: true } },
  { name: 'locationSharing empty string', path: '/privacy', json: { locationSharing: '' } },
  { name: 'allowCalls as string', path: '/privacy', json: { allowCalls: 'no' } },
  { name: 'allowChat as number', path: '/privacy', json: { allowChat: 0 } },
  { name: 'unknown key', path: '/privacy', json: { shareContacts: true } },
  { name: 'malformed JSON', path: '/privacy', raw: '{"allowCalls": ' },
]);

rejects('PATCH /partner/settings/security', [
  { name: 'empty object', path: '/security', json: {} },
  { name: 'loginAlerts as string', path: '/security', json: { loginAlerts: 'on' } },
  { name: 'loginAlerts null', path: '/security', json: { loginAlerts: null } },
  { name: '2FA is not accepted until central auth supports it', path: '/security', json: { twoFactor: true } },
  { name: 'password is not accepted here (central auth owns it)', path: '/security', json: { password: 'x', newPassword: 'y' } },
  { name: 'tokenVersion cannot be written', path: '/security', json: { tokenVersion: 0 } },
  { name: 'malformed JSON', path: '/security', raw: '{"loginAlerts": ' },
]);

describe('PATCH /partner/settings: oversized body', () => {
  test('body over the limit -> 413, not 500', async () => {
    const r = await call('PATCH', '/notifications', { json: { push: true, pad: 'x'.repeat(200_000) } });
    assert.equal(r.status, 413);
  });
});

/* ---------------- sessions + logout-all (central auth) ---------------- */
describe('GET /partner/settings/sessions: returns the real sessions, not a stub', () => {
  test('calls central auth for the signed-in partner and returns its list', async () => {
    const sessions = [
      { id: 's1', device: 'Chrome on Windows', ipAddress: '10.0.0.1', lastActiveAt: new Date().toISOString(), isCurrent: true },
      { id: 's2', device: 'Android app', ipAddress: '10.0.0.2', lastActiveAt: new Date().toISOString(), isCurrent: false },
    ];
    let seenUser = '';
    mock.method(authService, 'getSessions', (async (userId: string) => {
      seenUser = userId;
      return sessions;
    }) as never);
    const r = await call('GET', '/sessions');
    assert.equal(r.status, 200);
    assert.notEqual(r.status, 501, 'sessions must not be a hard-coded 501 stub');
    assert.equal(seenUser, ME);
    assert.deepEqual(r.body.data, sessions);
  });

  test('an account that no longer exists or is blocked -> 401 so the app signs out', async () => {
    mock.method(authService, 'getSessions', (async () => {
      throw new HttpError(401, 'Session expired', 'SESSION_EXPIRED');
    }) as never);
    const r = await call('GET', '/sessions');
    assert.equal(r.status, 401);
  });
});

describe('POST /partner/settings/logout-all: ends every session, not just the current one', () => {
  test('calls logoutAll for the signed-in partner even when there is NO refresh cookie', async () => {
    let seenUser = '';
    mock.method(authService, 'logoutAll', (async (userId: string) => {
      seenUser = userId;
      return { success: true, revokedSessionsCount: 3, message: 'Logged out from all devices' };
    }) as never);
    // single-session logout must NOT be what this route calls
    const single = mock.method(authService, 'logout', (async () => undefined) as never);

    const r = await call('POST', '/logout-all');
    assert.equal(r.status, 200);
    assert.equal(seenUser, ME, 'logoutAll must run for the signed-in partner');
    assert.equal(single.mock.callCount(), 0, 'the single-session logout must not be used for "logout all"');
    assert.equal((r.body.data as { revokedSessionsCount: number }).revokedSessionsCount, 3);
  });

  test('clears the refresh cookie on the way out', async () => {
    mock.method(authService, 'logoutAll', (async () => ({ success: true, revokedSessionsCount: 1, message: 'ok' })) as never);
    const r = await call('POST', '/logout-all');
    const cookies = r.headers.getSetCookie?.() ?? [];
    assert.ok(cookies.length > 0, 'expected the refresh cookie to be cleared');
  });

  test('a failure in central auth is surfaced, never reported as success', async () => {
    mock.method(console, 'error', () => {});
    mock.method(authService, 'logoutAll', (async () => {
      throw new Error('db down');
    }) as never);
    const r = await call('POST', '/logout-all');
    assert.equal(r.status, 500);
    assert.notEqual(r.body.success, true);
    assert.doesNotMatch(r.text, /db down/);
  });
});
