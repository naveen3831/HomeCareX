import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { NotificationModel } from '../../models/Notification';
import { SettingModel } from '../../models/Settings';
import { TicketModel } from '../../models/Ticket';
import { UserModel } from '../../models/User';
import { clearSettingsCache } from '../settings/settings.service';
import { sweepSlaBreaches } from '../admin-tickets/admin-tickets.sla-sweep';
import { alertKycSubmitted, alertPayoutFailed, alertRefundRequested, alertSlaBreach, alertSos } from './admin-alerts';

/*
 * Admin bell alerts. Models are replaced by in-memory stubs, so this checks what really gets saved for
 * each admin (type + ids in the payload), not a copy of the logic. Socket delivery is covered by
 * notify() itself: without a socket server it is skipped, and the row is saved either way.
 */
const ADMIN_A = String(new Types.ObjectId());
const ADMIN_B = String(new Types.ObjectId());

let created: { userId: string; type: string; payload: Record<string, unknown> }[] = [];
const orig = {
  create: NotificationModel.create,
  find: UserModel.find,
  settingFindOne: SettingModel.findOne,
  readyState: Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState'),
};

/** The alert helpers are fire-and-forget; wait until the saves they started have landed. */
const settle = async (expected: number) => {
  for (let i = 0; i < 50 && created.length < expected; i += 1) await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
  created = [];
  clearSettingsCache();
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  NotificationModel.create = (async (doc: { userId: string; type: string; payload: Record<string, unknown> }) => {
    created.push(doc);
    return { id: String(new Types.ObjectId()), userId: doc.userId, type: doc.type, payload: doc.payload, readAt: null, createdAt: new Date() };
  }) as never;
  UserModel.find = (() => ({ select: () => ({ lean: async () => [{ _id: ADMIN_A }, { _id: ADMIN_B }] }) })) as never;
  SettingModel.findOne = (() => ({ lean: async () => null })) as never;
});
afterEach(() => {
  Object.assign(NotificationModel, { create: orig.create });
  Object.assign(UserModel, { find: orig.find });
  Object.assign(SettingModel, { findOne: orig.settingFindOne });
  if (orig.readyState) Object.defineProperty(mongoose.connection, 'readyState', orig.readyState);
  else delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  clearSettingsCache();
});

test('each alert reaches every active admin with the right type and ids', async () => {
  alertSos({ bookingId: 'b1', partnerId: 'p1', partnerName: 'Ravi' });
  alertKycSubmitted({ partnerId: 'p2', partnerName: 'Asha' });
  alertRefundRequested({ refundId: 'r1', bookingId: 'b2', amount: 499 });
  alertPayoutFailed({ payoutId: 'po1', amount: 1200, partnerId: 'p3', partnerName: 'Imran' });
  alertSlaBreach({ ticketId: 't1', ticketRef: 'TCK-ABC123', priority: 'urgent' });
  await settle(10);

  assert.equal(created.length, 10); // 5 alerts x 2 admins
  const byType = (type: string) => created.filter((c) => c.type === type);
  for (const type of ['sos.alert', 'kyc.submitted', 'refund.requested', 'payout.failed', 'sla.breach']) {
    assert.deepEqual(byType(type).map((c) => c.userId).sort(), [ADMIN_A, ADMIN_B].sort(), type);
  }
  assert.equal(byType('sos.alert')[0].payload.bookingId, 'b1');
  assert.match(String(byType('sos.alert')[0].payload.message), /Ravi/);
  assert.equal(byType('kyc.submitted')[0].payload.partnerId, 'p2');
  assert.equal(byType('refund.requested')[0].payload.refundId, 'r1');
  assert.equal(byType('payout.failed')[0].payload.payoutId, 'po1');
  assert.equal(byType('sla.breach')[0].payload.ticketId, 't1');
});

test('muting booking alerts in Settings does not mute SOS or the other alerts', async () => {
  SettingModel.findOne = ((f: { key: string }) => ({
    lean: async () => (f.key === 'notifications.adminBookingAlerts' ? { key: f.key, value: false } : null),
  })) as never;
  alertSos({ bookingId: 'b1' });
  alertPayoutFailed({ payoutId: 'po1' });
  await settle(4);
  assert.deepEqual(created.map((c) => c.type).sort(), ['payout.failed', 'payout.failed', 'sos.alert', 'sos.alert']);
});

test('a failing save never throws into the caller', async () => {
  NotificationModel.create = (async () => {
    throw new Error('db down');
  }) as never;
  const log = console.error;
  console.error = () => undefined;
  try {
    assert.doesNotThrow(() => alertSos({ bookingId: 'b1' }));
    await new Promise((r) => setTimeout(r, 20));
  } finally {
    console.error = log;
  }
});

/* ---------- SLA sweep ---------- */
test('the SLA sweep announces a breached ticket once, even when run twice', async () => {
  const breached = { _id: new Types.ObjectId(), priority: 'urgent' };
  const claimed = new Set<string>();
  const origFind = TicketModel.find;
  const origUpdate = TicketModel.updateOne;
  TicketModel.find = (() => ({ select: () => ({ limit: () => ({ lean: async () => [breached] }) }) })) as never;
  TicketModel.updateOne = (async (f: { _id: Types.ObjectId }) => {
    const first = !claimed.has(String(f._id));
    claimed.add(String(f._id));
    return { modifiedCount: first ? 1 : 0 };
  }) as never;
  try {
    assert.equal(await sweepSlaBreaches(new Date('2026-10-23T10:00:00Z')), 1);
    assert.equal(await sweepSlaBreaches(new Date('2026-10-23T10:05:00Z')), 0);
    await settle(2);
    assert.deepEqual(created.map((c) => c.type), ['sla.breach', 'sla.breach']); // once per admin, not per run
    assert.equal(created[0].payload.priority, 'urgent');
  } finally {
    Object.assign(TicketModel, { find: origFind, updateOne: origUpdate });
  }
});
