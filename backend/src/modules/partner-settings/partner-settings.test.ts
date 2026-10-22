import * as assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { ZodTypeAny } from 'zod';
import { DEFAULT_PARTNER_SETTINGS } from '../../models/PartnerSettings';
import { partnerSettingsRepository as repo } from './partner-settings.repository';
import { partnerSettingsService as service } from './partner-settings.service';
import {
  notificationsPatchSchema,
  privacyPatchSchema,
  securityPatchSchema,
  settingsPatchSchema,
} from './partner-settings.validation';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

type Row = Record<string, unknown>;
const store = new Map<string, Row>();

// In-memory stand-in for Mongo: same dotted-path $set behaviour as the real upsert.
repo.findByUserId = (async (userId: string) => store.get(userId) ?? null) as never;
repo.upsert = (async (userId: string, set: Record<string, unknown>) => {
  const row: Row = store.get(userId) ?? {};
  for (const [path, value] of Object.entries(set)) {
    const [section, key] = path.split('.');
    if (key) row[section] = { ...((row[section] as Row | undefined) ?? {}), [key]: value };
    else row[section] = value;
  }
  row.updatedAt = new Date();
  store.set(userId, row);
  return row;
}) as never;

beforeEach(() => store.clear());

test('a partner with no saved settings gets the defaults, and reading saves nothing', async () => {
  const s = await service.get(A);
  assert.deepEqual({ ...s, updatedAt: null }, { ...DEFAULT_PARTNER_SETTINGS, updatedAt: null });
  assert.equal(s.updatedAt, null);
  assert.equal(store.size, 0);
});

test('notification changes persist and leave every other value alone', async () => {
  await service.updateNotifications(A, { sms: false, promotions: true });
  const s = await service.get(A);
  assert.equal(s.notifications.sms, false);
  assert.equal(s.notifications.promotions, true);
  assert.equal(s.notifications.push, true);
  assert.deepEqual(s.privacy, DEFAULT_PARTNER_SETTINGS.privacy);
  assert.ok(s.updatedAt);
});

test('privacy, security and language persist independently', async () => {
  await service.updatePrivacy(A, { locationSharing: 'online', allowCalls: false });
  await service.updateSecurity(A, { loginAlerts: false });
  await service.update(A, { language: 'hi' });
  const s = await service.get(A);
  assert.deepEqual(s.privacy, { locationSharing: 'online', allowCalls: false, allowChat: true });
  assert.deepEqual(s.security, { loginAlerts: false });
  assert.equal(s.language, 'hi');
  assert.deepEqual(s.notifications, DEFAULT_PARTNER_SETTINGS.notifications);
});

test('one request can change several sections at once', async () => {
  await service.update(A, { language: 'te', notifications: { email: false }, privacy: { allowChat: false } });
  const s = await service.get(A);
  assert.equal(s.language, 'te');
  assert.equal(s.notifications.email, false);
  assert.equal(s.privacy.allowChat, false);
});

test('settings belong to one partner only', async () => {
  await service.updateNotifications(A, { push: false });
  assert.equal((await service.get(A)).notifications.push, false);
  assert.equal((await service.get(B)).notifications.push, true);
});

test('an empty update is refused and saves nothing', async () => {
  await assert.rejects(() => service.update(A, {}), { statusCode: 400 });
  assert.equal(store.size, 0);
});

const REJECTED: Array<[string, ZodTypeAny, unknown]> = [
  ['notifications: text instead of boolean', notificationsPatchSchema, { push: 'yes' }],
  ['notifications: number instead of boolean', notificationsPatchSchema, { sms: 1 }],
  ['notifications: null', notificationsPatchSchema, { email: null }],
  ['notifications: empty body', notificationsPatchSchema, {}],
  ['notifications: unknown field', notificationsPatchSchema, { sms: true, newsletter: true }],
  ['privacy: bad location mode', privacyPatchSchema, { locationSharing: 'everyone' }],
  ['privacy: text instead of boolean', privacyPatchSchema, { allowCalls: 'no' }],
  ['privacy: empty body', privacyPatchSchema, {}],
  ['privacy: userId is not settable', privacyPatchSchema, { userId: A }],
  ['security: text instead of boolean', securityPatchSchema, { loginAlerts: 'true' }],
  ['security: 2FA is not supported yet', securityPatchSchema, { twoFactorEnabled: true }],
  ['security: password hash is not settable', securityPatchSchema, { passwordHash: 'x' }],
  ['security: empty body', securityPatchSchema, {}],
  ['settings: unsupported language', settingsPatchSchema, { language: 'fr' }],
  ['settings: empty body', settingsPatchSchema, {}],
  ['settings: empty section', settingsPatchSchema, { notifications: {} }],
  ['settings: invalid value inside a section', settingsPatchSchema, { notifications: { push: 'x' } }],
  ['settings: role is protected', settingsPatchSchema, { role: 'admin' }],
  ['settings: userId is protected', settingsPatchSchema, { userId: A }],
  ['settings: email is protected', settingsPatchSchema, { email: 'x@y.com' }],
  ['settings: phone is protected', settingsPatchSchema, { phone: '9999999999' }],
  ['settings: status is protected', settingsPatchSchema, { status: 'active' }],
  ['settings: tokenVersion is protected', settingsPatchSchema, { tokenVersion: 0 }],
];

for (const [name, schema, input] of REJECTED) {
  test(`invalid value is rejected: ${name}`, () => {
    assert.equal(schema.safeParse(input).success, false);
  });
}

test('valid values are accepted', () => {
  assert.equal(notificationsPatchSchema.safeParse({ push: false }).success, true);
  assert.equal(privacyPatchSchema.safeParse({ locationSharing: 'online' }).success, true);
  assert.equal(securityPatchSchema.safeParse({ loginAlerts: false }).success, true);
  assert.equal(settingsPatchSchema.safeParse({ language: 'hi', notifications: { jobAlerts: false } }).success, true);
});