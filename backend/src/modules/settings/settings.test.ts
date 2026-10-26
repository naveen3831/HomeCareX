import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { SettingModel } from '../../models/Settings';
import { auditService } from '../audit/audit.service';
import { bookingSettings } from '../bookings/bookings.settings';
import { clearSettingsCache, settingsService } from './settings.service';
import { checkSetting } from './settings.validation';

/* ---------- validation (pure) ---------- */
test('invalid settings are rejected with a clear message', () => {
  const bad: [Parameters<typeof checkSetting>[0], unknown][] = [
    ['tax.gstPercent', 150],
    ['tax.gstPercent', -1],
    ['tax.gstPercent', '18'],
    ['slots.capacityPerSlot', 0],
    ['slots.capacityPerSlot', 2.5],
    ['cancellation.windowHours', 500],
    ['support.email', 'not-an-email'],
    ['support.phone', 'abc'],
    ['business.name', '   '],
    ['serviceability.pincodes', ['500001', '12']],
    ['serviceability.pincodes', []],
    ['notifications.adminBookingAlerts', 'yes'],
  ];
  for (const [key, value] of bad) assert.equal(checkSetting(key, value).ok, false, `${key}=${JSON.stringify(value)}`);
});

test('valid settings are accepted and cleaned', () => {
  assert.deepEqual(checkSetting('slots.capacityPerSlot', 8), { ok: true, value: 8 });
  assert.deepEqual(checkSetting('business.name', '  Acme  '), { ok: true, value: 'Acme' });
  assert.deepEqual(checkSetting('support.phone', ''), { ok: true, value: '' });
  assert.deepEqual(checkSetting('serviceability.pincodes', ['500001', ' 500001 ', '500002']), { ok: true, value: ['500001', '500002'] });
});

/* ---------- service: validation, audit, slot capacity ---------- */
let store = new Map<string, unknown>();
let audits: Record<string, unknown>[] = [];
let writes = 0;
const orig = { find: SettingModel.find, findOne: SettingModel.findOne, bulkWrite: SettingModel.bulkWrite, audit: auditService.recordAudit };
const actor = { id: '64b000000000000000000001', ip: '10.0.0.1' };

beforeEach(() => {
  store = new Map();
  audits = [];
  writes = 0;
  clearSettingsCache();
  SettingModel.find = (() => ({ lean: async () => [...store].map(([key, value]) => ({ key, value })) })) as never;
  SettingModel.findOne = ((f: { key: string }) => ({ lean: async () => (store.has(f.key) ? { key: f.key, value: store.get(f.key) } : null) })) as never;
  SettingModel.bulkWrite = (async (ops: { updateOne: { filter: { key: string }; update: { $set: { value: unknown } } } }[]) => {
    writes += 1;
    for (const o of ops) store.set(o.updateOne.filter.key, o.updateOne.update.$set.value);
  }) as never;
  (auditService as unknown as { recordAudit: unknown }).recordAudit = async (i: Record<string, unknown>) => void audits.push(i);
});
afterEach(() => {
  Object.assign(SettingModel, { find: orig.find, findOne: orig.findOne, bulkWrite: orig.bulkWrite });
  (auditService as unknown as { recordAudit: unknown }).recordAudit = orig.audit;
  clearSettingsCache();
});

test('GET shape: every section lists label, value, description and validation', async () => {
  const { sections } = await settingsService.list();
  assert.deepEqual(sections.map((s) => s.id), ['business', 'pricing', 'tax', 'cancellation', 'support', 'booking', 'slots', 'notifications']);
  const slot = sections.find((s) => s.id === 'slots')!.settings[0];
  assert.equal(slot.key, 'slots.capacityPerSlot');
  assert.ok(slot.label && slot.description);
  assert.equal(slot.min, 1);
});

test('an invalid value changes nothing, not even the valid ones next to it, and is not audited', async () => {
  await assert.rejects(() => settingsService.updateMany({ 'slots.capacityPerSlot': 9, 'tax.gstPercent': 500 }, actor), (e: { status: number; details: { field: string }[] }) => {
    assert.equal(e.status, 400);
    assert.deepEqual(e.details.map((d) => d.field), ['tax.gstPercent']);
    return true;
  });
  await assert.rejects(() => settingsService.updateMany({ 'nope.key': 1 }, actor));
  assert.equal(writes, 0);
  assert.equal(audits.length, 0);
});

test('saving writes the change and audits it with before/after, actor and IP', async () => {
  const res = await settingsService.updateMany({ 'slots.capacityPerSlot': 9, 'tax.gstPercent': 18 }, actor);
  assert.deepEqual(res.changed, ['slots.capacityPerSlot']); // GST was already 18: no write, no audit
  assert.equal(audits.length, 1);
  assert.deepEqual(
    { ...audits[0] },
    { actor: actor.id, action: 'settings.updated', entity: 'Setting', entityId: 'slots.capacityPerSlot', before: { value: 5 }, after: { value: 9 }, ip: actor.ip, result: 'Success' },
  );
});

test('changing slot capacity changes what the booking slots use', async () => {
  assert.equal(await bookingSettings.getSlotCapacity('svc'), 5);
  await settingsService.updateMany({ 'slots.capacityPerSlot': 2 }, actor);
  assert.equal(await bookingSettings.getSlotCapacity('svc'), 2);
});
