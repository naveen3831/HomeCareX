import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { Query } from 'mingo';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import { NotificationModel } from '../../models/Notification';
import { authService } from '../auth/auth.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { groupOf } from './notifications.constants';
import { customerNotificationsRoutes } from './customer-notifications.routes';

/*
 * /customer/notifications through the real router, auth, role middleware and service. Only the Notification
 * model is replaced by an in-memory store that applies the service's REAL filters (via mingo), so isolation
 * is tested against the actual query, not a copy of it. Token format: "<role>:<userId>".
 */
const oid = () => String(new Types.ObjectId());
const ALICE = oid(), BOB = oid();
const bearer = (role: string, id = ALICE) => ({ Authorization: `Bearer ${role}:${id}` });

type Row = {
  _id: string; id: string; userId: string; type: string; payload: Record<string, unknown>; readAt: Date | null; createdAt: Date;
  save: () => Promise<void>;
};
let store: Row[] = [];
let n = 0;
const row = (userId: string, type: string, readAt: Date | null = null): Row => {
  const _id = oid();
  const r: Row = { _id, id: _id, userId, type, payload: { bookingId: oid() }, readAt, createdAt: new Date(Date.UTC(2026, 9, 1) + (n += 1) * 60_000), save: async () => undefined };
  return r;
};
const matches = (filter: Record<string, unknown>) => new Query(filter);

const origVerify = authService.verifyAccessToken;
const orig = { find: NotificationModel.find, findOne: NotificationModel.findOne, aggregate: NotificationModel.aggregate, updateMany: NotificationModel.updateMany, deleteOne: NotificationModel.deleteOne, deleteMany: NotificationModel.deleteMany };

const app = express();
app.use('/customer/notifications', customerNotificationsRoutes);
app.use(errorHandler);
let base = '';
let close = () => Promise.resolve();

beforeEach(() => {
  n = 0;
  store = [
    row(ALICE, 'booking.assigned'), row(ALICE, 'booking.completed', new Date('2026-10-01')), row(ALICE, 'refund.updated'), row(ALICE, 'payout.processed'),
    row(ALICE, 'partner.approved'), row(ALICE, 'offer.new'), row(ALICE, 'ticket.reply'), row(ALICE, 'system.announcement'), row(ALICE, 'some.future.type'),
    row(BOB, 'booking.assigned'), row(BOB, 'ticket.reply'),
  ];
});

before(() => {
  authService.verifyAccessToken = ((token: string): AccessTokenPayload => {
    const [role, sub] = token.split(':');
    if (!sub) throw Object.assign(new Error('bad token'), { status: 401 });
    return { sub, role } as AccessTokenPayload;
  }) as never;
  NotificationModel.find = ((filter: Record<string, unknown>) => {
    const rows = store.filter((r) => matches(filter).test(r)).sort((a, b) => +b.createdAt - +a.createdAt);
    const chain = { sort: () => chain, limit: async (k: number) => rows.slice(0, k) };
    return chain;
  }) as never;
  NotificationModel.findOne = (async (filter: Record<string, unknown>) => store.find((r) => matches(filter).test(r)) ?? null) as never;
  NotificationModel.aggregate = (async (pipeline: [{ $match: { userId: Types.ObjectId } }]) => {
    const mine = store.filter((r) => r.userId === String(pipeline[0].$match.userId));
    const byType = new Map<string, { _id: string; total: number; unread: number }>();
    for (const r of mine) {
      const g = byType.get(r.type) ?? { _id: r.type, total: 0, unread: 0 };
      g.total += 1;
      if (r.readAt === null) g.unread += 1;
      byType.set(r.type, g);
    }
    return [...byType.values()];
  }) as never;
  NotificationModel.updateMany = (async (filter: Record<string, unknown>, update: { $set: { readAt: Date } }) => {
    const hit = store.filter((r) => matches(filter).test(r));
    hit.forEach((r) => { r.readAt = update.$set.readAt; });
    return { modifiedCount: hit.length };
  }) as never;
  NotificationModel.deleteOne = (async (filter: Record<string, unknown>) => {
    const hit = store.find((r) => matches(filter).test(r));
    if (hit) store = store.filter((r) => r !== hit);
    return { deletedCount: hit ? 1 : 0 };
  }) as never;
  NotificationModel.deleteMany = (async (filter: Record<string, unknown>) => {
    const hit = store.filter((r) => matches(filter).test(r));
    store = store.filter((r) => !hit.includes(r));
    return { deletedCount: hit.length };
  }) as never;
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});

after(async () => {
  authService.verifyAccessToken = origVerify;
  Object.assign(NotificationModel, orig);
  await close();
});

interface Item { id: string; userId: string; type: string; group: string; readAt: string | null }
interface Body { success: boolean; message?: string; code?: string; data: Item[] & { updated?: number; deleted?: number }; meta?: { unread: number; groups: Record<string, { total: number; unread: number }> } }
const call = async (method: string, path: string, headers: Record<string, string> = {}) => {
  const res = await fetch(base + path, { method, headers });
  return { status: res.status, body: (await res.json()) as Body };
};

/* ---------- auth + role ---------- */
test('no token -> 401; partner and admin tokens -> 403', async () => {
  assert.equal((await call('GET', '/customer/notifications')).status, 401);
  assert.equal((await call('PATCH', '/customer/notifications/read-all')).status, 401);
  assert.equal((await call('DELETE', '/customer/notifications')).status, 401);
  assert.equal((await call('DELETE', `/customer/notifications/${store[0].id}`)).status, 401);
  for (const role of ['partner', 'admin']) {
    assert.equal((await call('GET', '/customer/notifications', bearer(role))).status, 403, role);
    assert.equal((await call('PATCH', `/customer/notifications/${store[0].id}/read`, bearer(role))).status, 403, role);
    assert.equal((await call('PATCH', '/customer/notifications/read-all', bearer(role))).status, 403, role);
    assert.equal((await call('DELETE', `/customer/notifications/${store[0].id}`, bearer(role))).status, 403, role);
    assert.equal((await call('DELETE', '/customer/notifications', bearer(role))).status, 403, role);
  }
  assert.ok(store.filter((r) => r.userId === ALICE).filter((r) => r.type !== 'booking.completed').every((r) => r.readAt === null));
});

/* ---------- listing + groups ---------- */
test('lists only the caller\'s notifications, newest first; another customer\'s are never returned', async () => {
  const r = await call('GET', '/customer/notifications', bearer('customer'));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 9);
  assert.ok(r.body.data.every((x) => x.userId === ALICE));
  const bobs = await call('GET', '/customer/notifications', bearer('customer', BOB));
  assert.equal(bobs.body.data.length, 2);
  assert.ok(bobs.body.data.every((x) => x.userId === BOB));
});

test('every type lands in the right group; unknown/future types are "system"', () => {
  const expected: Record<string, string> = {
    'booking.assigned': 'booking', 'booking.cancelled': 'booking', 'payment.succeeded': 'payment', 'payment.failed': 'payment', 'payout.processed': 'payment',
    'refund.updated': 'payment', 'partner.approved': 'partner', 'partner.rejected': 'partner', 'offer.new': 'offers', 'ticket.reply': 'support',
    'system.announcement': 'system', 'some.future.type': 'system',
  };
  for (const [type, group] of Object.entries(expected)) assert.equal(groupOf(type), group, type);
});

test('?group= returns exactly that tab (system = everything unclassified)', async () => {
  const types = async (g: string) => (await call('GET', `/customer/notifications?group=${g}`, bearer('customer'))).body.data.map((x) => x.type).sort();
  assert.deepEqual(await types('booking'), ['booking.assigned', 'booking.completed']);
  assert.deepEqual(await types('payment'), ['payout.processed', 'refund.updated']);
  assert.deepEqual(await types('partner'), ['partner.approved']);
  assert.deepEqual(await types('offers'), ['offer.new']);
  assert.deepEqual(await types('support'), ['ticket.reply']);
  assert.deepEqual(await types('system'), ['some.future.type', 'system.announcement']);
});

test('meta carries the unread total and zero-filled per-group counts for the tab badges (own rows only)', async () => {
  const { meta } = (await call('GET', '/customer/notifications', bearer('customer'))).body;
  assert.equal(meta?.unread, 8); // 9 rows, 1 already read
  assert.deepEqual(meta?.groups.booking, { total: 2, unread: 1 });
  assert.deepEqual(meta?.groups.payment, { total: 2, unread: 2 });
  assert.deepEqual(meta?.groups.system, { total: 2, unread: 2 });
  assert.deepEqual(Object.keys(meta?.groups ?? {}).sort(), ['booking', 'offers', 'partner', 'payment', 'support', 'system']);
});

test('?unread=true hides the read ones; bad group / unknown params / bad limit -> 400', async () => {
  const r = await call('GET', '/customer/notifications?unread=true', bearer('customer'));
  assert.equal(r.body.data.length, 8);
  assert.ok(r.body.data.every((x) => x.readAt === null));
  for (const qs of ['group=billing', 'unread=maybe', 'limit=0', 'limit=101', 'userId=' + BOB]) {
    assert.equal((await call('GET', `/customer/notifications?${qs}`, bearer('customer'))).status, 400, qs);
  }
});

/* ---------- mark read ---------- */
test('PATCH /:id/read marks one of my notifications read and returns it with its group', async () => {
  const target = store[0];
  const r = await call('PATCH', `/customer/notifications/${target.id}/read`, bearer('customer'));
  assert.equal(r.status, 200);
  assert.equal((r.body.data as unknown as Item).group, 'booking');
  assert.ok(target.readAt instanceof Date);
});

test('marking an already-read notification keeps its original read time', async () => {
  const target = store[1];
  const before = target.readAt;
  assert.equal((await call('PATCH', `/customer/notifications/${target.id}/read`, bearer('customer'))).status, 200);
  assert.equal(target.readAt, before);
});

test('another customer\'s notification id -> 404 (same as a missing one) and it stays unread', async () => {
  const bobs = store.find((r) => r.userId === BOB)!;
  const foreign = await call('PATCH', `/customer/notifications/${bobs.id}/read`, bearer('customer'));
  const missing = await call('PATCH', `/customer/notifications/${oid()}/read`, bearer('customer'));
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(foreign.body.message, missing.body.message);
  assert.equal(bobs.readAt, null);
});

test('malformed notification id -> 400', async () => {
  for (const id of ['nope', '123', '%24ne']) assert.equal((await call('PATCH', `/customer/notifications/${id}/read`, bearer('customer'))).status, 400, id);
});

test('PATCH /read-all marks only my unread ones and reports how many; another customer\'s stay unread', async () => {
  const r = await call('PATCH', '/customer/notifications/read-all', bearer('customer'));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.updated, 8);
  assert.ok(store.filter((x) => x.userId === ALICE).every((x) => x.readAt !== null));
  assert.ok(store.filter((x) => x.userId === BOB).every((x) => x.readAt === null));
  assert.equal((await call('PATCH', '/customer/notifications/read-all', bearer('customer'))).body.data.updated, 0);
});

/* ---------- delete ---------- */
test('DELETE /:id removes only that one of mine from the database', async () => {
  const target = store.find((r) => r.userId === ALICE)!;
  const r = await call('DELETE', `/customer/notifications/${target.id}`, bearer('customer'));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.deleted, 1);
  assert.equal(store.some((x) => x.id === target.id), false);
  assert.equal(store.filter((x) => x.userId === ALICE).length, 8);
  assert.equal(store.filter((x) => x.userId === BOB).length, 2);
});

test('DELETE /:id on another customer\'s or a missing id -> 404 and nothing is deleted; malformed id -> 400', async () => {
  const bobs = store.find((r) => r.userId === BOB)!;
  assert.equal((await call('DELETE', `/customer/notifications/${bobs.id}`, bearer('customer'))).status, 404);
  assert.equal((await call('DELETE', `/customer/notifications/${oid()}`, bearer('customer'))).status, 404);
  assert.equal(store.length, 11);
  for (const id of ['nope', '123']) assert.equal((await call('DELETE', `/customer/notifications/${id}`, bearer('customer'))).status, 400, id);
});

test('DELETE / clears all of my notifications and nobody else\'s', async () => {
  const r = await call('DELETE', '/customer/notifications', bearer('customer'));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.deleted, 9);
  assert.equal(store.filter((x) => x.userId === ALICE).length, 0);
  assert.equal(store.filter((x) => x.userId === BOB).length, 2);
  assert.equal((await call('DELETE', '/customer/notifications', bearer('customer'))).body.data.deleted, 0);
});
