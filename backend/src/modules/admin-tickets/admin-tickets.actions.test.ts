import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { errorHandler } from '../../middleware/error.middleware';
import { TicketModel } from '../../models/Ticket';
import { initSockets } from '../../sockets';
import { TICKET_EVENTS } from '../../sockets/ticket.socket';
import { auditService } from '../audit/audit.service';
import { ROLE_PERMISSIONS } from '../auth/auth.constants';
import { refundsService } from '../refunds/refunds.service';
import refundsRoutes from '../refunds/refunds.routes';
import { PAYMENTS_REFUND } from '../admin-payments/admin-payments.constants';
import { adminTicketsRepository, type TicketLean, type TicketMessageLean, type UserLean } from './admin-tickets.repository';
import { adminTicketsRoutes } from './admin-tickets.routes';
import { adminTicketsService } from './admin-tickets.service';
import { postMessageSchema, updatePrioritySchema, updateStatusSchema } from './admin-tickets.validation';

/* ---------------- in-memory world ---------------- */

const oid = () => new Types.ObjectId();
const NOW = new Date('2026-10-15T10:00:00.000Z');
const ADMIN = oid();
const CUSTOMER = oid();
const OTHER_CUSTOMER = oid();
const BOOKING = new Types.ObjectId('64b0000000000000000a1b2c');

const users: (UserLean & { role: string })[] = [
  { _id: ADMIN, role: 'admin', name: 'Asha Admin', email: 'asha@hcx.in' },
  { _id: CUSTOMER, role: 'customer', name: 'Ananya Rao', email: 'ananya@x.com', phone: '9000000011' },
  { _id: OTHER_CUSTOMER, role: 'customer', name: 'Bharat Singh', email: 'bharat@x.com' },
];

const mk = (o: Partial<TicketLean> = {}): TicketLean =>
  ({
    _id: oid(),
    createdBy: CUSTOMER,
    createdByRole: 'customer',
    category: 'payment',
    subject: 'Refund not received',
    status: 'open',
    priority: 'normal',
    assignedTo: null,
    bookingId: null,
    lastMessageAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...o,
  }) as TicketLean;

let tickets: TicketLean[] = [];
let messages: TicketMessageLean[] = [];
let audits: Record<string, unknown>[] = [];
let auditShouldFail = false;
let raceOnWrite = false;
let tickCounter = 0;

const original = { ...adminTicketsRepository };
const originalAudit = auditService.recordAudit.bind(auditService);
const find = (id: string) => tickets.find((t) => String(t._id) === id) ?? null;

function reset() {
  tickets = [
    mk({ bookingId: BOOKING }), // [0] open, with booking
    mk({ status: 'closed' }), // [1]
    mk({ status: 'resolved' }), // [2]
    mk({ priority: 'high' }), // [3]
  ];
  messages = [];
  audits = [];
  auditShouldFail = false;
  raceOnWrite = false;
  Object.assign(adminTicketsRepository, {
    findById: async (id: string) => find(id),
    findUsersByIds: async (list: Types.ObjectId[]) => users.filter((u) => list.some((i) => String(i) === String(u._id))),
    findBookingSummary: async (id: string) =>
      String(id) === String(BOOKING)
        ? { _id: BOOKING, serviceName: 'AC Repair', status: 'COMPLETED', paymentStatus: 'PAID', scheduledAt: NOW, partnerId: null, address: { line1: '12 MG Road', city: 'Hyderabad', pincode: '500001' }, priceBreakdown: { total: 899 } }
        : null,
    findPartnerUser: async () => null,
    setStatus: async (id: string, from: string, to: string) => {
      const t = find(id)!;
      if (raceOnWrite || t.status !== from) return null;
      t.status = to as never;
      t.updatedAt = new Date(NOW.getTime() + ++tickCounter * 1000);
      return t;
    },
    setPriority: async (id: string, from: string, to: string) => {
      const t = find(id)!;
      if (raceOnWrite || t.priority !== from || t.status === 'closed') return null;
      t.priority = to as never;
      t.updatedAt = new Date(NOW.getTime() + ++tickCounter * 1000);
      return t;
    },
    createMessage: async (i: { ticketId: string; senderId: string; body: string; internal: boolean }) => {
      const m = { _id: oid(), ticketId: new Types.ObjectId(i.ticketId), senderId: new Types.ObjectId(i.senderId), senderRole: 'admin', body: i.body, attachments: [], isInternal: i.internal, readAt: null, createdAt: new Date(NOW.getTime() + ++tickCounter * 1000) } as TicketMessageLean;
      messages.push(m);
      return m;
    },
  });
  (auditService as unknown as Record<string, unknown>).recordAudit = async (input: Record<string, unknown>) => {
    if (auditShouldFail) throw new Error('audit down');
    audits.push(input);
  };
}
const restore = () => {
  Object.assign(adminTicketsRepository, original);
  (auditService as unknown as Record<string, unknown>).recordAudit = originalAudit;
};
const actor = { id: String(ADMIN), ip: '10.0.0.1' };
type Fail = { status: number; code: string };
const fails = (status: number, code: string) => (e: Fail) => e.status === status && e.code === code;

/* ---------------- validation ---------------- */

describe('validation: status / priority / message', () => {
  test('status and priority accept only the contract values (lowercase)', () => {
    for (const s of ['open', 'in_progress', 'resolved', 'closed']) assert.ok(updateStatusSchema.safeParse({ status: s }).success, s);
    for (const s of ['OPEN', 'done', '', undefined, null]) assert.ok(!updateStatusSchema.safeParse({ status: s }).success, String(s));
    for (const p of ['low', 'normal', 'high', 'urgent']) assert.ok(updatePrioritySchema.safeParse({ priority: p }).success, p);
    assert.ok(!updatePrioritySchema.safeParse({ priority: 'critical' }).success);
  });

  test('message body is trimmed, required and capped; internal defaults to false and must be a boolean', () => {
    const ok = postMessageSchema.parse({ body: '  hello  ' });
    assert.deepEqual(ok, { body: 'hello', internal: false });
    assert.equal(postMessageSchema.parse({ body: 'x', internal: true }).internal, true);
    for (const bad of [{}, { body: '' }, { body: '   ' }, { body: 'x'.repeat(4001) }, { body: 'x', internal: 'yes' }, { body: 42 }]) {
      assert.ok(!postMessageSchema.safeParse(bad).success, JSON.stringify(bad).slice(0, 40));
    }
    assert.ok(postMessageSchema.safeParse({ body: 'x'.repeat(4000) }).success);
  });
});

/* ---------------- service ---------------- */

describe('adminTicketsService.updateStatus', () => {
  before(reset);
  after(restore);

  test('changes status, writes one audit row, returns the updated ticket', async () => {
    reset();
    const t = tickets[0];
    const res = await adminTicketsService.updateStatus(String(t._id), 'resolved', actor, NOW);
    assert.equal(res.status, 'resolved');
    assert.equal(res.sla, null); // resolved tickets have no running SLA
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'ticket.status_changed');
    assert.deepEqual(audits[0].before, { status: 'open' });
    assert.deepEqual(audits[0].after, { status: 'resolved' });
    assert.equal(audits[0].actor, actor.id);
  });

  test('a resolved ticket can be reopened', async () => {
    reset();
    const res = await adminTicketsService.updateStatus(String(tickets[2]._id), 'open', actor, NOW);
    assert.equal(res.status, 'open');
  });

  test('same status is a no-op: no write, no audit', async () => {
    reset();
    const res = await adminTicketsService.updateStatus(String(tickets[0]._id), 'open', actor, NOW);
    assert.equal(res.status, 'open');
    assert.equal(audits.length, 0);
  });

  test('closed is final -> 409 CONFLICT; unknown ticket -> 404', async () => {
    reset();
    await assert.rejects(adminTicketsService.updateStatus(String(tickets[1]._id), 'open', actor), fails(409, 'CONFLICT'));
    assert.equal(tickets[1].status, 'closed');
    await assert.rejects(adminTicketsService.updateStatus(String(oid()), 'open', actor), fails(404, 'TICKET_NOT_FOUND'));
  });

  test('lost race -> 409 and no audit row', async () => {
    reset();
    raceOnWrite = true;
    await assert.rejects(adminTicketsService.updateStatus(String(tickets[0]._id), 'resolved', actor), fails(409, 'CONFLICT'));
    assert.equal(audits.length, 0);
  });

  test('audit failure never undoes the change', async () => {
    reset();
    auditShouldFail = true;
    const orig = console.error;
    console.error = () => undefined;
    try {
      const res = await adminTicketsService.updateStatus(String(tickets[0]._id), 'in_progress', actor, NOW);
      assert.equal(res.status, 'in_progress');
    } finally {
      console.error = orig;
    }
  });
});

describe('adminTicketsService.updatePriority', () => {
  before(reset);
  after(restore);

  test('escalating to urgent works, is audited, and is a no-op when already urgent', async () => {
    reset();
    const id = String(tickets[3]._id); // high
    const res = await adminTicketsService.updatePriority(id, 'urgent', actor, NOW);
    assert.equal(res.priority, 'urgent');
    assert.equal(audits[0].action, 'ticket.priority_changed');
    assert.deepEqual(audits[0].before, { priority: 'high' });
    audits.length = 0;
    assert.equal((await adminTicketsService.updatePriority(id, 'urgent', actor, NOW)).priority, 'urgent');
    assert.equal(audits.length, 0);
  });

  test('closed ticket -> 409; unknown -> 404', async () => {
    reset();
    await assert.rejects(adminTicketsService.updatePriority(String(tickets[1]._id), 'urgent', actor), fails(409, 'CONFLICT'));
    await assert.rejects(adminTicketsService.updatePriority(String(oid()), 'urgent', actor), fails(404, 'TICKET_NOT_FOUND'));
  });
});

describe('adminTicketsService.get (requester + booking context)', () => {
  before(reset);
  after(restore);

  test('includes the booking context when the ticket has a booking, null otherwise', async () => {
    reset();
    const withBooking = await adminTicketsService.get(String(tickets[0]._id), NOW);
    assert.equal(withBooking.requester.name, 'Ananya Rao');
    assert.deepEqual(withBooking.bookingContext, {
      id: String(BOOKING), ref: 'BK-A1B2C', serviceName: 'AC Repair', status: 'COMPLETED', paymentStatus: 'PAID',
      scheduledAt: NOW.toISOString(), total: 899, address: '12 MG Road, Hyderabad, 500001', partner: null,
    });
    assert.equal((await adminTicketsService.get(String(tickets[3]._id), NOW)).bookingContext, null);
  });

  test('a deleted booking is just "no context", not an error', async () => {
    reset();
    tickets[3].bookingId = oid();
    assert.equal((await adminTicketsService.get(String(tickets[3]._id), NOW)).bookingContext, null);
  });
});

describe('adminTicketsService.postMessage', () => {
  before(reset);
  after(restore);

  test('saves an admin reply with the sender name, audits it', async () => {
    reset();
    const dto = await adminTicketsService.postMessage(String(tickets[0]._id), { body: 'We are on it', internal: false }, actor);
    assert.equal(messages.length, 1);
    assert.equal(dto.body, 'We are on it');
    assert.equal(dto.internal, false);
    assert.deepEqual(dto.sender, { id: actor.id, name: 'Asha Admin', role: 'admin' });
    assert.equal(audits[0].action, 'ticket.replied');
  });

  test('internal note is flagged and audited as a note', async () => {
    reset();
    const dto = await adminTicketsService.postMessage(String(tickets[0]._id), { body: 'Customer is abusive', internal: true }, actor);
    assert.equal(dto.internal, true);
    assert.equal(audits[0].action, 'ticket.noted');
  });

  test('closed ticket -> 409 and nothing saved; unknown -> 404', async () => {
    reset();
    await assert.rejects(adminTicketsService.postMessage(String(tickets[1]._id), { body: 'hi', internal: false }, actor), fails(409, 'CONFLICT'));
    assert.equal(messages.length, 0);
    await assert.rejects(adminTicketsService.postMessage(String(oid()), { body: 'hi', internal: false }, actor), fails(404, 'TICKET_NOT_FOUND'));
  });

  test('audit failure never loses the message', async () => {
    reset();
    auditShouldFail = true;
    const orig = console.error;
    console.error = () => undefined;
    try {
      const dto = await adminTicketsService.postMessage(String(tickets[0]._id), { body: 'still sent', internal: false }, actor);
      assert.equal(dto.body, 'still sent');
      assert.equal(messages.length, 1);
    } finally {
      console.error = orig;
    }
  });
});

/* ---------------- HTTP + live (real routes, real Socket.IO server) ---------------- */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const tokenFor = (sub: string, role: string) => jwt.sign({ sub, role }, secret, { expiresIn: '5m' });

describe('HTTP + live delivery', () => {
  let server: HttpServer;
  let origin = '';
  const sockets: ClientSocket[] = [];
  const savedPerms = [...ROLE_PERMISSIONS.admin];
  const originalExists = TicketModel.exists.bind(TicketModel);
  const originalCreateRefund = refundsService.createRefund.bind(refundsService);
  const originalUpdateRefund = refundsService.updateRefund.bind(refundsService);

  before(async () => {
    reset();
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin/tickets', adminTicketsRoutes);
    app.use('/api/v1/admin', refundsRoutes);
    app.use(errorHandler);
    server = createServer(app);
    initSockets(server);
    await new Promise<void>((r) => server.listen(0, r));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    (TicketModel as unknown as { exists: unknown }).exists = async (f: { _id: string }) => (find(String(f._id)) ? { _id: f._id } : null);
  });
  after(async () => {
    for (const s of sockets) s.close();
    ROLE_PERMISSIONS.admin = savedPerms;
    (TicketModel as unknown as { exists: unknown }).exists = originalExists;
    (refundsService as unknown as Record<string, unknown>).createRefund = originalCreateRefund;
    (refundsService as unknown as Record<string, unknown>).updateRefund = originalUpdateRefund;
    restore();
    await new Promise<void>((r) => server.close(() => r()));
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Body = { success: boolean; code?: string; message?: string; data?: any; details?: { field: string }[] };
  async function call(method: string, path: string, opts: { token?: string; json?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${origin}/api/v1/admin${path}`, { method, headers, body: opts.json === undefined ? undefined : JSON.stringify(opts.json) });
    return { status: res.status, body: (await res.json()) as Body };
  }
  const admin = () => tokenFor(String(ADMIN), 'admin');

  const open = async (token: string): Promise<ClientSocket> => {
    const s = connect(origin, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    await new Promise<void>((res, rej) => {
      s.once('connect', () => res());
      s.once('connect_error', rej);
    });
    return s;
  };
  const join = (s: ClientSocket, ticketId: string) =>
    new Promise<{ ok: boolean; code?: string }>((r) => s.timeout(2000).emit(TICKET_EVENTS.join, { ticketId }, (err: Error | null, res: { ok: boolean; code?: string }) => r(err ? { ok: false, code: 'TIMEOUT' } : res)));
  const nextEvent = <T,>(s: ClientSocket, event: string, ms = 1500) =>
    new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => (s.off(event, h), resolve(null)), ms);
      const h = (p: T) => (clearTimeout(timer), resolve(p));
      s.once(event, h);
    });

  test('401 without a token; 403 for customers and partners', async () => {
    const id = String(tickets[0]._id);
    assert.equal((await call('POST', `/tickets/${id}/messages`, { json: { body: 'x' } })).status, 401);
    for (const role of ['customer', 'partner']) {
      const t = tokenFor(String(CUSTOMER), role);
      assert.equal((await call('POST', `/tickets/${id}/messages`, { token: t, json: { body: 'x' } })).status, 403, role);
      assert.equal((await call('PATCH', `/tickets/${id}/status`, { token: t, json: { status: 'resolved' } })).status, 403, role);
    }
  });

  test('tickets:manage is enforced on messages, status and priority', async () => {
    const id = String(tickets[0]._id);
    ROLE_PERMISSIONS.admin = ['payments:read'];
    try {
      for (const [m, p, json] of [['POST', `/tickets/${id}/messages`, { body: 'x' }], ['PATCH', `/tickets/${id}/status`, { status: 'resolved' }], ['PATCH', `/tickets/${id}/priority`, { priority: 'urgent' }]] as const) {
        const r = await call(m, p, { token: admin(), json });
        assert.equal(r.status, 403, p);
        assert.equal(r.body.code, 'MISSING_PERMISSION', p);
        assert.match(r.body.message ?? '', /tickets:manage/);
      }
      assert.equal(find(id)!.status, 'open');
      assert.equal(messages.length, 0);
    } finally {
      ROLE_PERMISSIONS.admin = savedPerms;
    }
  });

  test('PATCH status / priority over HTTP, with 400 / 404 / 409 mapping', async () => {
    reset();
    const id = String(tickets[0]._id);
    const ok = await call('PATCH', `/tickets/${id}/status`, { token: admin(), json: { status: 'resolved' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'resolved');
    assert.equal((await call('PATCH', `/tickets/${id}/status`, { token: admin(), json: { status: 'bogus' } })).status, 400);
    assert.equal((await call('PATCH', `/tickets/${id}/status`, { token: admin(), json: {} })).status, 400);
    assert.equal((await call('PATCH', `/tickets/not-an-id/status`, { token: admin(), json: { status: 'open' } })).status, 400);
    assert.equal((await call('PATCH', `/tickets/${oid()}/status`, { token: admin(), json: { status: 'open' } })).status, 404);
    assert.equal((await call('PATCH', `/tickets/${tickets[1]._id}/status`, { token: admin(), json: { status: 'open' } })).status, 409);
    const pr = await call('PATCH', `/tickets/${id}/priority`, { token: admin(), json: { priority: 'urgent' } });
    assert.equal(pr.status, 200);
    assert.equal(pr.body.data.priority, 'urgent');
  });

  test('POST messages: 201 + saved message; 400 on empty/oversized/wrong-typed body', async () => {
    reset();
    const id = String(tickets[0]._id);
    const r = await call('POST', `/tickets/${id}/messages`, { token: admin(), json: { body: 'Hello there' } });
    assert.equal(r.status, 201);
    assert.equal(r.body.success, true);
    assert.equal(r.body.data.body, 'Hello there');
    assert.equal(r.body.data.internal, false);
    for (const bad of [{}, { body: '  ' }, { body: 'x'.repeat(4001) }, { body: 'ok', internal: 'true' }]) {
      const e = await call('POST', `/tickets/${id}/messages`, { token: admin(), json: bad });
      assert.equal(e.status, 400, JSON.stringify(bad).slice(0, 30));
      assert.equal(e.body.code, 'VALIDATION_ERROR');
    }
    assert.equal(messages.length, 1);
    assert.equal((await call('POST', `/tickets/${tickets[1]._id}/messages`, { token: admin(), json: { body: 'x' } })).status, 409);
  });

  test('ACCEPTANCE: an agent reply reaches the customer live; an internal note does not', async () => {
    reset();
    const id = String(tickets[0]._id);
    const customer = await open(tokenFor(String(CUSTOMER), 'customer'));
    const stranger = await open(tokenFor(String(OTHER_CUSTOMER), 'customer'));

    const gotReply = nextEvent<{ id: string; body: string; internal: boolean; ticketId: string }>(customer, TICKET_EVENTS.message);
    const strangerGot = nextEvent(stranger, TICKET_EVENTS.message, 400);
    const post = await call('POST', `/tickets/${id}/messages`, { token: admin(), json: { body: 'Refund issued today' } });
    assert.equal(post.status, 201);
    const live = await gotReply;
    assert.ok(live, 'customer should receive ticket:message');
    assert.equal(live.body, 'Refund issued today');
    assert.equal(live.ticketId, id);
    assert.equal(live.id, post.body.data.id);
    assert.equal(await strangerGot, null, 'another customer must not receive it');

    const noteLeak = nextEvent(customer, TICKET_EVENTS.message, 500);
    assert.equal((await call('POST', `/tickets/${id}/messages`, { token: admin(), json: { body: 'Escalating to finance', internal: true } })).status, 201);
    assert.equal(await noteLeak, null, 'internal note must never reach the customer');
  });

  test('admins who join the ticket room see replies AND internal notes; customers cannot join', async () => {
    reset();
    const id = String(tickets[0]._id);
    const agent = await open(admin());
    const customer = await open(tokenFor(String(CUSTOMER), 'customer'));
    assert.equal((await join(agent, id)).ok, true);
    assert.deepEqual(await join(customer, id), { ok: false, code: 'RESOURCE_FORBIDDEN', message: 'You cannot watch this ticket' });
    assert.equal((await join(agent, String(oid()))).code, 'TICKET_NOT_FOUND');
    assert.equal((await join(agent, 'nope')).code, 'VALIDATION_ERROR');

    const note = nextEvent<{ internal: boolean; body: string }>(agent, TICKET_EVENTS.message);
    await call('POST', `/tickets/${id}/messages`, { token: admin(), json: { body: 'private', internal: true } });
    const seen = await note;
    assert.equal(seen?.body, 'private');
    assert.equal(seen?.internal, true);
  });

  test('status change is pushed to the customer (status only, never priority)', async () => {
    reset();
    const id = String(tickets[0]._id);
    const customer = await open(tokenFor(String(CUSTOMER), 'customer'));
    const upd = nextEvent<Record<string, unknown>>(customer, TICKET_EVENTS.updated);
    await call('PATCH', `/tickets/${id}/status`, { token: admin(), json: { status: 'resolved' } });
    const got = await upd;
    assert.equal(got?.status, 'resolved');
    assert.equal(got?.ticketId, id);
    assert.ok(!('priority' in (got ?? {})), 'priority is internal');
  });

  test('FINANCE: refund / credit needs payments:refund, tickets:manage alone is not enough', async () => {
    let created = 0;
    let decided = 0;
    (refundsService as unknown as Record<string, unknown>).createRefund = async () => (created++, { id: 'r1' });
    (refundsService as unknown as Record<string, unknown>).updateRefund = async () => (decided++, { id: 'r1' });
    const payload = { paymentId: String(oid()), amount: 100, reason: 'Service not delivered', method: 'WALLET' };

    ROLE_PERMISSIONS.admin = ['tickets:manage', 'payments:read'];
    try {
      const create = await call('POST', '/refunds', { token: admin(), json: payload });
      assert.equal(create.status, 403);
      assert.equal(create.body.code, 'MISSING_PERMISSION');
      assert.match(create.body.message ?? '', new RegExp(PAYMENTS_REFUND));
      const decide = await call('PATCH', `/refunds/${oid()}`, { token: admin(), json: { action: 'approve' } });
      assert.equal(decide.status, 403);
      assert.equal(created + decided, 0, 'the refund service must not be reached');

      ROLE_PERMISSIONS.admin = ['payments:refund'];
      assert.equal((await call('POST', '/refunds', { token: admin(), json: payload })).status, 201);
      assert.equal((await call('PATCH', `/refunds/${oid()}`, { token: admin(), json: { action: 'approve' } })).status, 200);
      assert.equal(created, 1);
      assert.equal(decided, 1);
    } finally {
      ROLE_PERMISSIONS.admin = savedPerms;
    }
  });

  test('FINANCE: customers and partners are still rejected outright', async () => {
    for (const role of ['customer', 'partner']) {
      assert.equal((await call('POST', '/refunds', { token: tokenFor(String(CUSTOMER), role), json: {} })).status, 403, role);
    }
  });
});