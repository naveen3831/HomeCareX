import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Query } from 'mingo';
import { Types } from 'mongoose';
import { errorHandler } from '../../middleware/error.middleware';
import { ROLE_PERMISSIONS } from '../auth/auth.constants';
import { auditService } from '../audit/audit.service';
import { SLA_TARGET_HOURS } from './admin-tickets.constants';
import { adminTicketsRepository, type TicketLean, type UserLean } from './admin-tickets.repository';
import { adminStaffRoutes, adminTicketsRoutes } from './admin-tickets.routes';
import { adminTicketsService, buildSearchClause, buildTicketFilter, computeSla } from './admin-tickets.service';
import { listTicketsQuerySchema, type ListTicketsQuery } from './admin-tickets.validation';

/* ---------------- seed: customer + partner tickets in ONE queue ---------------- */

const oid = () => new Types.ObjectId();
const NOW = new Date('2026-10-14T10:00:00.000Z');
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const ADMIN_A = oid();
const ADMIN_B = oid();
const ADMIN_BLOCKED = oid();
const CUSTOMER = oid();
const PARTNER = oid();
const CUSTOMER_2 = oid();
const GHOST = oid(); // requester whose user record was deleted
const BOOKING = new Types.ObjectId('64b0000000000000000a1b2c');

const users: (UserLean & { role: string })[] = [
  { _id: ADMIN_A, role: 'admin', name: 'Asha Admin', email: 'asha@hcx.in', status: 'active' },
  { _id: ADMIN_B, role: 'admin', name: 'Bala Admin', email: 'bala@hcx.in', status: 'active' },
  { _id: ADMIN_BLOCKED, role: 'admin', name: 'Old Admin', email: 'old@hcx.in', status: 'blocked' },
  { _id: CUSTOMER, role: 'customer', name: 'Ananya Rao', email: 'ananya@x.com', phone: '9000000011' },
  { _id: CUSTOMER_2, role: 'customer', name: 'Bharat Singh', email: 'bharat@x.com', phone: '9000000012' },
  { _id: PARTNER, role: 'partner', name: 'Ramesh Plumber', email: 'ramesh@x.com', phone: '9000000099' },
];

let seq = 0;
const mk = (o: Partial<TicketLean> & Pick<TicketLean, 'createdBy' | 'createdByRole'>): TicketLean =>
  ({
    _id: oid(),
    category: 'booking',
    subject: `Ticket ${++seq}`,
    status: 'open',
    priority: 'normal',
    assignedTo: null,
    bookingId: null,
    lastMessageAt: ago(100 - seq),
    createdAt: ago(1),
    updatedAt: ago(1),
    ...o,
  }) as TicketLean;

const T = {
  custOpen: mk({ createdBy: CUSTOMER, createdByRole: 'customer', category: 'payment', createdAt: ago(1), bookingId: BOOKING }),
  partnerUrgentBreached: mk({ createdBy: PARTNER, createdByRole: 'partner', category: 'safety', priority: 'urgent', createdAt: ago(5), assignedTo: ADMIN_A }),
  custHighAtRisk: mk({ createdBy: CUSTOMER_2, createdByRole: 'customer', priority: 'high', status: 'in_progress', createdAt: ago(7), assignedTo: ADMIN_B }),
  partnerLowOk: mk({ createdBy: PARTNER, createdByRole: 'partner', priority: 'low', category: 'app_issue', createdAt: ago(10) }),
  custResolvedOld: mk({ createdBy: CUSTOMER, createdByRole: 'customer', status: 'resolved', createdAt: ago(500), assignedTo: ADMIN_A }),
  custClosed: mk({ createdBy: CUSTOMER_2, createdByRole: 'customer', status: 'closed', createdAt: ago(600), assignedTo: ADMIN_B }),
  ghost: mk({ createdBy: GHOST, createdByRole: 'customer', createdAt: ago(30) }), // normal, 30h > 24h => breached
};
const tickets = Object.values(T);
const seedAssignee = new Map(tickets.map((t) => [String(t._id), t.assignedTo]));

const baseQuery: ListTicketsQuery = { page: 1, limit: 20 };
const filterOf = (q: Partial<ListTicketsQuery>, requesterIds?: Types.ObjectId[]) =>
  buildTicketFilter({ ...baseQuery, ...q }, { now: NOW, actorId: String(ADMIN_A), requesterIds });
const match = (q: Partial<ListTicketsQuery>, requesterIds?: Types.ObjectId[]): TicketLean[] => {
  const f = filterOf(q, requesterIds);
  assert.ok(f, 'filter should be matchable');
  return tickets.filter((t) => new Query(f as never).test(t as never));
};
const ids = (rows: TicketLean[]) => new Set(rows.map((r) => String(r._id)));
const idsOf = (...ts: TicketLean[]) => new Set(ts.map((t) => String(t._id)));

/* ---------------- filters ---------------- */

describe('GET /admin/tickets filters', () => {
  test('no filters: customer AND partner tickets come back in the same queue', () => {
    const rows = match({});
    assert.equal(rows.length, tickets.length);
    const roles = new Set(rows.map((r) => r.createdByRole));
    assert.deepEqual([...roles].sort(), ['customer', 'partner']);
  });

  test('status / priority / category, single and multi-value', () => {
    assert.deepEqual(ids(match({ status: ['in_progress'] })), idsOf(T.custHighAtRisk));
    assert.deepEqual(ids(match({ status: ['open', 'in_progress'] })).size, 5);
    assert.deepEqual(ids(match({ priority: ['urgent', 'high'] })), idsOf(T.partnerUrgentBreached, T.custHighAtRisk));
    assert.deepEqual(ids(match({ category: ['safety'] })), idsOf(T.partnerUrgentBreached));
    assert.deepEqual(ids(match({ status: ['open'], category: ['payment'] })), idsOf(T.custOpen));
  });

  test('requesterRole narrows the one queue', () => {
    assert.equal(match({ requesterRole: 'partner' }).length, 2);
    assert.ok(match({ requesterRole: 'customer' }).every((t) => t.createdByRole === 'customer'));
  });

  test('assignee: id, "me" (the caller) and "unassigned"', () => {
    assert.deepEqual(ids(match({ assignee: String(ADMIN_B) })), idsOf(T.custHighAtRisk, T.custClosed));
    assert.deepEqual(ids(match({ assignee: 'me' })), idsOf(T.partnerUrgentBreached, T.custResolvedOld)); // actor = ADMIN_A
    assert.deepEqual(ids(match({ assignee: 'unassigned' })), idsOf(T.custOpen, T.partnerLowOk, T.ghost));
  });

  test('requester: by id, and by free text via resolved user ids', () => {
    assert.deepEqual(ids(match({ requester: String(CUSTOMER) })), idsOf(T.custOpen, T.custResolvedOld));
    // free text was resolved to [PARTNER] by the service
    assert.deepEqual(ids(match({ requester: 'ramesh' }, [PARTNER])), idsOf(T.partnerUrgentBreached, T.partnerLowOk));
  });

  test('requester free text that matches nobody can never match: filter is null', () => {
    assert.equal(filterOf({ requester: 'nobody' }, []), null);
    assert.equal(filterOf({ requester: 'nobody' }, undefined), null);
  });

  test('booking: full id, BK- reference (case-insensitive) and bare suffix; tickets without a booking never match', () => {
    assert.deepEqual(ids(match({ booking: String(BOOKING) })), idsOf(T.custOpen));

    // The ref match uses { $expr: $regexMatch on $toString('$bookingId') }. Real MongoDB renders an ObjectId as its
    // 24-char hex there; mingo cannot, so these cases run against copies whose bookingId is already that hex string.
    const asMongoSees = tickets.map((t) => ({ ...t, bookingId: t.bookingId ? String(t.bookingId) : null }));
    const matchRef = (booking: string) => {
      const f = filterOf({ booking })!;
      return new Set(asMongoSees.filter((t) => new Query(f as never).test(t as never)).map((t) => String(t._id)));
    };
    assert.deepEqual(matchRef('BK-A1B2C'), idsOf(T.custOpen));
    assert.deepEqual(matchRef('bk-a1b2c'), idsOf(T.custOpen));
    assert.deepEqual(matchRef('a1b2c'), idsOf(T.custOpen));
    assert.equal(matchRef('BK-FFFFF').size, 0);
    assert.equal(filterOf({ booking: 'BK-not hex!' }), null);
  });

  test('date range is inclusive and uses IST day boundaries', () => {
    const t1 = mk({ createdBy: CUSTOMER, createdByRole: 'customer', createdAt: new Date('2026-10-01T18:29:59.000Z') }); // 23:59:59 IST on Oct 1
    const t2 = mk({ createdBy: CUSTOMER, createdByRole: 'customer', createdAt: new Date('2026-10-01T18:30:00.000Z') }); // 00:00:00 IST on Oct 2
    const f = buildTicketFilter({ ...baseQuery, from: '2026-10-02', to: '2026-10-02' }, { now: NOW, actorId: 'x' })!;
    assert.equal(new Query(f as never).test(t1 as never), false);
    assert.equal(new Query(f as never).test(t2 as never), true);
  });

  test('filters combine with AND', () => {
    assert.deepEqual(ids(match({ requesterRole: 'customer', assignee: String(ADMIN_B), status: ['in_progress'] })), idsOf(T.custHighAtRisk));
    assert.equal(match({ requesterRole: 'partner', assignee: String(ADMIN_B) }).length, 0);
  });
});

/* ---------------- SLA ---------------- */

/* ---------------- search ---------------- */

describe('search: one box, matched everywhere it could mean something', () => {
  // Mongo renders an ObjectId as its 24-char hex inside $expr; mingo cannot, so these run on string copies.
  const withIds = (id: string, over: Partial<TicketLean> & { bookingId?: unknown } = {}) => {
    const t = mk({ createdBy: CUSTOMER, createdByRole: 'customer', ...over });
    return { ...t, _id: id, bookingId: over.bookingId ? String(over.bookingId) : null };
  };
  const hit = (term: string, docs: ReturnType<typeof withIds>[], userIds: Types.ObjectId[] = []) => {
    const q = new Query(buildSearchClause(term, userIds) as never);
    return docs.filter((d) => q.test(d as never)).map((d) => d._id);
  };

  const byTailOnly = withIds('64b0000000000000000decade'); // ref TCK-DECADE: the ticket id ends in "decade"
  const bySubject = withIds('64b0000000000000000000a1', { subject: 'Decade old geyser stopped working' });
  const unrelated = withIds('64b0000000000000000000a2', { subject: 'AC not cooling' });
  const faceBooking = withIds('64b0000000000000000000a3', { bookingId: new Types.ObjectId('64b00000000000000000face') });
  const faceSubject = withIds('64b0000000000000000000a4', { subject: 'Face wash dispenser broken' });
  const all = [byTailOnly, bySubject, unrelated, faceBooking, faceSubject];

  test('a plain word that happens to be valid hex still finds its subject AND an id that ends the same way', () => {
    // "decade" is valid hex and 6 chars: it is a candidate ticket-ref tail, but it must not stop being a word.
    assert.deepEqual(hit('decade', all).sort(), [byTailOnly._id, bySubject._id].sort());
    assert.deepEqual(hit('DECADE', all).sort(), [byTailOnly._id, bySubject._id].sort());
  });

  test('"face" is both a word and a booking-ref tail: subject and booking both match', () => {
    assert.deepEqual(hit('face', all).sort(), [faceBooking._id, faceSubject._id].sort());
  });

  test('very short hex-looking words are only words: no id-tail matching under 4 chars', () => {
    const endsInBad = withIds('64b0000000000000000000bad');
    const wordBad = withIds('64b0000000000000000000a5', { subject: 'Bad smell from drain' });
    assert.deepEqual(hit('bad', [endsInBad, wordBad]), [wordBad._id]);
  });

  test('prefixed refs are precise: TCK- matches the ticket id tail, BK- the booking tail, not each other', () => {
    assert.deepEqual(hit('TCK-DECADE', all), [byTailOnly._id]);
    assert.deepEqual(hit('TCK-1DECADE', all), []); // 7 chars is not a ticket ref
    assert.deepEqual(hit('tck-decade', all), [byTailOnly._id]);
    assert.deepEqual(hit('BK-0FACE', all), [faceBooking._id]);
    assert.deepEqual(hit('bk-face', all), [faceBooking._id]);
    assert.deepEqual(hit('BK-decade', all), []); // 6 chars is not a booking ref, and "BK-" says it is not a word either
    // short prefixed refs work even though a bare 2-char word would not
    assert.deepEqual(hit('TCK-DE', all), [byTailOnly._id]);
  });

  test('a pasted 24-char id finds the ticket, its booking, or its requester', () => {
    // Exact-id clauses compare real ObjectIds, so these fixtures keep real ObjectIds (no $expr involved).
    const tid = oid();
    const bid = oid();
    const real = [
      { ...mk({ createdBy: CUSTOMER_2, createdByRole: 'customer', subject: 'A' }), _id: tid },
      { ...mk({ createdBy: CUSTOMER_2, createdByRole: 'customer', subject: 'B' }), bookingId: bid },
      { ...mk({ createdBy: PARTNER, createdByRole: 'partner', subject: 'C' }) },
    ];
    const hitReal = (term: string) => real.filter((d) => new Query(buildSearchClause(term) as never).test(d as never)).map((d) => d.subject);
    assert.deepEqual(hitReal(String(tid)), ['A']);
    assert.deepEqual(hitReal(String(bid)), ['B']);
    assert.deepEqual(hitReal(String(CUSTOMER_2)), ['A', 'B']);
    assert.deepEqual(hitReal(String(oid())), []);
  });

  test('requester matches come from the resolved user ids (name / email / phone)', () => {
    const other = withIds('64b0000000000000000000a6', { createdBy: PARTNER, createdByRole: 'partner' });
    assert.deepEqual(hit('ramesh', [...all, other], [PARTNER]), [other._id]);
    assert.deepEqual(hit('ramesh', [...all, other], []), []);
  });

  test('regex characters in the term are matched literally and never throw', () => {
    const odd = withIds('64b0000000000000000000a7', { subject: 'Price is 5000 (approx.) ?' });
    assert.deepEqual(hit('(approx.)', [odd, unrelated]), [odd._id]);
    for (const term of ['(', '[', '*', '\\', 'a+b', '$^', '.*']) assert.doesNotThrow(() => hit(term, all), term);
    assert.deepEqual(hit('.*', all), []); // not a wildcard
  });

  test('search is part of the validated query and combines with other filters by AND', () => {
    const parsed = listTicketsQuerySchema.parse({ search: '  Decade  ', status: 'open' });
    assert.equal(parsed.search, 'Decade');
    assert.equal(listTicketsQuerySchema.parse({ search: '' }).search, undefined);
    assert.equal(listTicketsQuerySchema.safeParse({ search: 'x'.repeat(101) }).success, false);
    const f = filterOf({ search: 'ramesh', status: ['open'] }, undefined);
    assert.ok(f && JSON.stringify(f).includes('"$and"'));
  });
});

describe('SLA (derived from priority + createdAt)', () => {
  test('filter: breached / at_risk / ok, resolved & closed never match', () => {
    assert.deepEqual(ids(match({ sla: 'breached' })), idsOf(T.partnerUrgentBreached, T.ghost));
    assert.deepEqual(ids(match({ sla: 'at_risk' })), idsOf(T.custHighAtRisk));
    assert.deepEqual(ids(match({ sla: 'ok' })), idsOf(T.custOpen, T.partnerLowOk));
  });

  test('the Mongo filter and the response field agree for every ticket (no boundary drift)', () => {
    for (const state of ['ok', 'at_risk', 'breached'] as const) {
      for (const t of match({ sla: state })) assert.equal(computeSla(t, NOW)?.state, state, `${t.subject} should be ${state}`);
    }
  });

  test('boundaries per priority: exactly at 75% is at_risk, exactly at target is breached', () => {
    for (const [priority, hours] of Object.entries(SLA_TARGET_HOURS)) {
      const at = (h: number) => computeSla({ status: 'open', priority: priority as 'low', createdAt: ago(h) }, NOW)!.state;
      assert.equal(at(hours * 0.75 - 0.01), 'ok', `${priority} just under 75%`);
      assert.equal(at(hours * 0.75), 'at_risk', `${priority} at 75%`);
      assert.equal(at(hours - 0.01), 'at_risk', `${priority} just under target`);
      assert.equal(at(hours), 'breached', `${priority} at target`);
    }
  });

  test('dueAt = createdAt + target; resolved/closed have no SLA', () => {
    const sla = computeSla(T.partnerUrgentBreached, NOW)!;
    assert.equal(sla.dueAt, new Date(T.partnerUrgentBreached.createdAt.getTime() + 4 * 3_600_000).toISOString());
    assert.equal(sla.targetHours, 4);
    assert.equal(computeSla(T.custResolvedOld, NOW), null);
    assert.equal(computeSla(T.custClosed, NOW), null);
  });

  test('sla combined with status=resolved is empty, not an error', () => {
    assert.equal(match({ sla: 'breached', status: ['resolved'] }).length, 0);
  });
});

/* ---------------- query validation ---------------- */

describe('query validation', () => {
  const parse = (q: Record<string, unknown>) => listTicketsQuerySchema.safeParse(q);

  test('defaults, empty params ignored, csv + repeated params, case-insensitive enums', () => {
    const r = parse({ status: 'Open,in_progress', priority: ['high', 'urgent'], category: '', sla: 'BREACHED', requesterRole: 'Partner' });
    assert.ok(r.success);
    assert.deepEqual(r.data.status, ['open', 'in_progress']);
    assert.deepEqual(r.data.priority, ['high', 'urgent']);
    assert.equal(r.data.category, undefined);
    assert.equal(r.data.sla, 'breached');
    assert.equal(r.data.requesterRole, 'partner');
    assert.equal(r.data.page, 1);
    assert.equal(r.data.limit, 20);
  });

  test('rejects bad values with a field path', () => {
    for (const bad of [{ status: 'bogus' }, { priority: 'meh' }, { sla: 'late' }, { assignee: 'someone' }, { page: '0' }, { limit: '101' }, { from: 'yesterday' }, { requesterRole: 'admin' }]) {
      assert.equal(parse(bad).success, false, JSON.stringify(bad));
    }
    assert.equal(parse({ from: '2026-10-05', to: '2026-10-01' }).success, false);
  });

  test('assignee accepts me / unassigned / an id', () => {
    for (const a of ['me', 'ME', 'unassigned', String(ADMIN_A)]) assert.ok(parse({ assignee: a }).success, a);
  });
});

/* ---------------- service ---------------- */

const original = { ...adminTicketsRepository };
const originalAudit = auditService.recordAudit.bind(auditService);
const audits: Record<string, unknown>[] = [];
let auditShouldFail = false;
let writes: { id: string; from: unknown; to: string | null }[] = [];
let findCalls = 0;
let raceOnWrite = false;

const stubRepo = () => {
  for (const t of tickets) t.assignedTo = seedAssignee.get(String(t._id)) as never;
  findCalls = 0;
  writes = [];
  audits.length = 0;
  auditShouldFail = false;
  raceOnWrite = false;
  const byId = (id: string) => users.find((u) => String(u._id) === id);
  Object.assign(adminTicketsRepository, {
    find: async (filter: unknown, skip: number, limit: number) => {
      findCalls++;
      return tickets
        .filter((t) => new Query(filter as never).test(t as never))
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .slice(skip, skip + limit);
    },
    count: async (filter: unknown) => tickets.filter((t) => new Query(filter as never).test(t as never)).length,
    findById: async (id: string) => tickets.find((t) => String(t._id) === id) ?? null,
    findUsersByIds: async (list: Types.ObjectId[]) => users.filter((u) => list.some((i) => String(i) === String(u._id))),
    findUserIdsByText: async (text: string) =>
      users.filter((u) => [u.name, u.email, u.phone].some((v) => v?.toLowerCase().includes(text.toLowerCase()))).map((u) => u._id),
    listAssignableAdmins: async () =>
      users
        .filter((u) => u.role === 'admin' && u.status !== 'blocked')
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    findAdminUser: async (id: string) => {
      const u = byId(id);
      return u && u.role === 'admin' ? u : null;
    },
    setAssignee: async (id: string, from: Types.ObjectId | null, to: string | null) => {
      const t = tickets.find((x) => String(x._id) === id)!;
      writes.push({ id, from, to });
      if (raceOnWrite || String(t.assignedTo ?? null) !== String(from ?? null) || t.status === 'closed') return null;
      t.assignedTo = to ? new Types.ObjectId(to) : (null as never);
      return t;
    },
  });
  (auditService as unknown as Record<string, unknown>).recordAudit = async (input: Record<string, unknown>) => {
    if (auditShouldFail) throw new Error('audit down');
    audits.push(input);
  };
};
const restoreRepo = () => {
  Object.assign(adminTicketsRepository, original);
  (auditService as unknown as Record<string, unknown>).recordAudit = originalAudit;
};
const actor = { id: String(ADMIN_A), ip: '10.0.0.1' };

describe('adminTicketsService.list', () => {
  before(stubRepo);
  after(restoreRepo);

  test('one queue: customer + partner rows with requester role, booking ref, assignee, sla', async () => {
    const res = await adminTicketsService.list({ ...baseQuery, limit: 50 }, actor, NOW);
    assert.equal(res.meta.total, tickets.length);
    const partnerRow = res.items.find((i) => i.id === String(T.partnerUrgentBreached._id))!;
    assert.equal(partnerRow.requester.role, 'partner');
    assert.equal(partnerRow.requester.name, 'Ramesh Plumber');
    assert.equal(partnerRow.assignee?.name, 'Asha Admin');
    assert.equal(partnerRow.sla?.state, 'breached');
    const custRow = res.items.find((i) => i.id === String(T.custOpen._id))!;
    assert.equal(custRow.requester.role, 'customer');
    assert.equal(custRow.booking?.ref, 'BK-A1B2C');
    assert.equal(custRow.assignee, null);
    assert.match(custRow.ticketRef, /^TCK-[A-F0-9]{6}$/);
  });

  test('response never carries user secrets, only whitelisted person fields', async () => {
    const res = await adminTicketsService.list(baseQuery, actor, NOW);
    for (const row of res.items) {
      assert.deepEqual(Object.keys(row.requester).sort(), ['email', 'id', 'name', 'phone', 'role']);
    }
  });

  test('a deleted requester keeps their id, with null name/email/phone', async () => {
    const res = await adminTicketsService.list({ ...baseQuery, requester: String(GHOST) }, actor, NOW);
    assert.equal(res.items.length, 1);
    assert.deepEqual(res.items[0].requester, { id: String(GHOST), name: null, email: null, phone: null, role: 'customer' });
  });

  test('newest activity first, and pagination meta', async () => {
    const p1 = await adminTicketsService.list({ ...baseQuery, limit: 3 }, actor, NOW);
    const p3 = await adminTicketsService.list({ ...baseQuery, limit: 3, page: 3 }, actor, NOW);
    assert.equal(p1.items.length, 3);
    assert.equal(p3.items.length, 1);
    assert.deepEqual(p1.meta, { page: 1, limit: 3, total: 7, pages: 3 });
    const times = p1.items.map((i) => i.lastMessageAt);
    assert.deepEqual(times, [...times].sort().reverse());
  });

  test('free-text requester is resolved to user ids; unknown text returns empty WITHOUT querying tickets', async () => {
    const hit = await adminTicketsService.list({ ...baseQuery, requester: '9000000099' }, actor, NOW);
    assert.equal(hit.items.length, 2);
    findCalls = 0;
    const miss = await adminTicketsService.list({ ...baseQuery, requester: 'zzz-nobody' }, actor, NOW);
    assert.deepEqual(miss, { items: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    assert.equal(findCalls, 0);
  });

  test('search: requester name resolves to users and returns their tickets from both customers and partners', async () => {
    stubRepo();
    const byName = await adminTicketsService.list({ ...baseQuery, search: 'ananya' }, actor, NOW);
    assert.deepEqual(new Set(byName.items.map((i) => i.id)), idsOf(T.custOpen, T.custResolvedOld));
    const byPhone = await adminTicketsService.list({ ...baseQuery, search: '9000000099' }, actor, NOW);
    assert.deepEqual(new Set(byPhone.items.map((i) => i.id)), idsOf(T.partnerUrgentBreached, T.partnerLowOk));
  });

  test('search by subject, case-insensitively, and nothing matching returns an empty page (not an error)', async () => {
    stubRepo();
    const bySubject = await adminTicketsService.list({ ...baseQuery, search: 'TICKET 1' }, actor, NOW);
    assert.ok(bySubject.items.length >= 1);
    assert.ok(bySubject.items.every((i) => /ticket 1/i.test(i.subject)));
    const none = await adminTicketsService.list({ ...baseQuery, search: 'zzzzzz-no-such-thing' }, actor, NOW);
    assert.deepEqual(none, { items: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
  });

  test('search + filters: both must hold', async () => {
    stubRepo();
    const r = await adminTicketsService.list({ ...baseQuery, search: 'ananya', status: ['resolved'] }, actor, NOW);
    assert.deepEqual(new Set(r.items.map((i) => i.id)), idsOf(T.custResolvedOld));
  });

  test('a pasted user id is not text-searched: no user lookup, matched as an id', async () => {
    stubRepo();
    let lookups = 0;
    const prev = adminTicketsRepository.findUserIdsByText;
    adminTicketsRepository.findUserIdsByText = async (...a: Parameters<typeof prev>) => (lookups++, prev(...a));
    try {
      const r = await adminTicketsService.list({ ...baseQuery, search: String(PARTNER) }, actor, NOW);
      assert.equal(lookups, 0);
      assert.deepEqual(new Set(r.items.map((i) => i.id)), idsOf(T.partnerUrgentBreached, T.partnerLowOk));
    } finally {
      adminTicketsRepository.findUserIdsByText = prev;
    }
  });

  test('assignee=me uses the calling admin', async () => {
    const res = await adminTicketsService.list({ ...baseQuery, assignee: 'me' }, { id: String(ADMIN_B) }, NOW);
    assert.deepEqual(new Set(res.items.map((i) => i.id)), idsOf(T.custHighAtRisk, T.custClosed));
  });
});

describe('adminTicketsService.listAssignableAgents', () => {
  test('active admins only, by name; blocked admins, customers and partners are never offered', async () => {
    stubRepo();
    const agents = await adminTicketsService.listAssignableAgents();
    assert.deepEqual(agents, [
      { id: String(ADMIN_A), name: 'Asha Admin', email: 'asha@hcx.in' },
      { id: String(ADMIN_B), name: 'Bala Admin', email: 'bala@hcx.in' },
    ]);
  });

  test('everyone offered is accepted by assign (the picker never lists someone assign would reject)', async () => {
    stubRepo();
    for (const a of await adminTicketsService.listAssignableAgents()) {
      const t = tickets.find((x) => x.status !== 'closed' && !x.assignedTo)!;
      await assert.doesNotReject(adminTicketsService.assign(String(t._id), { assigneeId: a.id }, actor, NOW));
      stubRepo();
    }
  });
});

describe('adminTicketsService.assign', () => {
  before(stubRepo);
  after(restoreRepo);

  test('assigns an unassigned ticket and writes one audit row', async () => {
    const t = T.custOpen;
    const res = await adminTicketsService.assign(String(t._id), { assigneeId: String(ADMIN_B) }, actor, NOW);
    assert.equal(res.assignee?.id, String(ADMIN_B));
    assert.equal(res.assignee?.name, 'Bala Admin');
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'ticket.assigned');
    assert.deepEqual(audits[0].before, { assignedTo: null });
    assert.deepEqual(audits[0].after, { assignedTo: String(ADMIN_B) });
    assert.equal(audits[0].actor, actor.id);
    assert.equal(audits[0].ip, '10.0.0.1');
    assert.equal(audits[0].entityId, String(t._id));
  });

  test('reassign, then unassign with null', async () => {
    const t = T.custOpen; // currently ADMIN_B
    audits.length = 0;
    const re = await adminTicketsService.assign(String(t._id), { assigneeId: String(ADMIN_A) }, actor, NOW);
    assert.equal(re.assignee?.id, String(ADMIN_A));
    assert.equal(audits[0].action, 'ticket.reassigned');
    const un = await adminTicketsService.assign(String(t._id), { assigneeId: null }, actor, NOW);
    assert.equal(un.assignee, null);
    assert.equal(audits[1].action, 'ticket.unassigned');
  });

  test('assigning does not touch status, priority or lastMessageAt', async () => {
    const t = T.custHighAtRisk;
    const before = { status: t.status, priority: t.priority, lastMessageAt: t.lastMessageAt };
    const res = await adminTicketsService.assign(String(t._id), { assigneeId: String(ADMIN_A) }, actor, NOW);
    assert.equal(res.status, before.status);
    assert.equal(res.priority, before.priority);
    assert.equal(res.lastMessageAt, before.lastMessageAt.toISOString());
  });

  test('same assignee again is a no-op: 200 shape, no write, no audit', async () => {
    const t = T.partnerUrgentBreached; // ADMIN_A
    writes.length = 0;
    audits.length = 0;
    const res = await adminTicketsService.assign(String(t._id), { assigneeId: String(ADMIN_A) }, actor, NOW);
    assert.equal(res.assignee?.id, String(ADMIN_A));
    assert.equal(writes.length, 0);
    assert.equal(audits.length, 0);
    const unassignedAlready = await adminTicketsService.assign(String(T.partnerLowOk._id), { assigneeId: null }, actor, NOW);
    assert.equal(unassignedAlready.assignee, null);
    assert.equal(writes.length, 0);
  });

  test('unknown ticket -> 404 TICKET_NOT_FOUND', async () => {
    await assert.rejects(adminTicketsService.assign(String(oid()), { assigneeId: null }, actor), (e: { status: number; code: string }) => e.status === 404 && e.code === 'TICKET_NOT_FOUND');
  });

  test('closed ticket cannot be reassigned -> 409, nothing written', async () => {
    writes.length = 0;
    await assert.rejects(adminTicketsService.assign(String(T.custClosed._id), { assigneeId: String(ADMIN_A) }, actor), (e: { status: number; code: string }) => e.status === 409 && e.code === 'CONFLICT');
    assert.equal(writes.length, 0);
  });

  test('assignee must be an existing, active ADMIN user -> 400 on assigneeId', async () => {
    const cases = [String(CUSTOMER), String(PARTNER), String(oid()), String(ADMIN_BLOCKED)];
    for (const assigneeId of cases) {
      await assert.rejects(
        adminTicketsService.assign(String(T.partnerLowOk._id), { assigneeId }, actor),
        (e: { status: number; code: string; details?: { field: string }[] }) => e.status === 400 && e.code === 'VALIDATION_ERROR' && e.details?.[0].field === 'assigneeId',
        assigneeId,
      );
    }
  });

  test('lost race (changed between read and write) -> 409, no audit', async () => {
    raceOnWrite = true;
    audits.length = 0;
    await assert.rejects(adminTicketsService.assign(String(T.partnerLowOk._id), { assigneeId: String(ADMIN_B) }, actor), (e: { status: number }) => e.status === 409);
    assert.equal(audits.length, 0);
    raceOnWrite = false;
  });

  test('audit failure never undoes or fails the assignment', async () => {
    auditShouldFail = true;
    const orig = console.error;
    const logged: unknown[][] = [];
    console.error = (...a: unknown[]) => void logged.push(a);
    try {
      const res = await adminTicketsService.assign(String(T.partnerLowOk._id), { assigneeId: String(ADMIN_B) }, actor, NOW);
      assert.equal(res.assignee?.id, String(ADMIN_B));
    } finally {
      console.error = orig;
    }
    assert.equal(logged.length, 1);
  });
});

/* ---------------- HTTP: real routes, auth, permission, validation, error handler ---------------- */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const tokenFor = (sub: string, role: string) => jwt.sign({ sub, role }, secret, { expiresIn: '5m' });

describe('HTTP /api/v1/admin/tickets', () => {
  let base = '';
  let staffBase = '';
  let close: () => Promise<void>;
  const savedAdminPerms = [...ROLE_PERMISSIONS.admin];

  before(async () => {
    stubRepo();
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin/tickets', adminTicketsRoutes);
    app.use('/api/v1/admin/ticket-assignees', adminStaffRoutes);
    app.use(errorHandler);
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    base = `${origin}/api/v1/admin/tickets`;
    staffBase = `${origin}/api/v1/admin/ticket-assignees`;
    close = () => new Promise((r) => server.close(() => r()));
  });
  after(async () => {
    ROLE_PERMISSIONS.admin = savedAdminPerms;
    restoreRepo();
    await close();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Body = { success: boolean; code?: string; message?: string; data?: any; meta?: any; details?: { field: string }[] };
  async function call(method: string, path: string, opts: { token?: string; json?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }
    const res = await fetch(`${base}${path}`, { method, headers, body });
    return { status: res.status, body: (await res.json()) as Body };
  }
  const admin = () => tokenFor(String(ADMIN_A), 'admin');

  test('401 without a token', async () => {
    assert.equal((await call('GET', '/')).status, 401);
    assert.equal((await call('PATCH', `/${T.custOpen._id}/assign`, { json: { assigneeId: null } })).status, 401);
  });

  test('403 for customers and partners', async () => {
    for (const role of ['customer', 'partner']) {
      const t = tokenFor(String(CUSTOMER), role);
      assert.equal((await call('GET', '/', { token: t })).status, 403, `${role} list`);
      assert.equal((await call('PATCH', `/${T.custOpen._id}/assign`, { token: t, json: { assigneeId: null } })).status, 403, `${role} assign`);
    }
  });

  test('tickets:manage is enforced: an admin without it gets 403 MISSING_PERMISSION', async () => {
    ROLE_PERMISSIONS.admin = ['payments:read'];
    try {
      const list = await call('GET', '/', { token: admin() });
      assert.equal(list.status, 403);
      assert.equal(list.body.code, 'MISSING_PERMISSION');
      assert.match(list.body.message ?? '', /tickets:manage/);
      assert.equal((await call('PATCH', `/${T.custOpen._id}/assign`, { token: admin(), json: { assigneeId: null } })).status, 403);
      ROLE_PERMISSIONS.admin = ['tickets:manage'];
      assert.equal((await call('GET', '/', { token: admin() })).status, 200);
    } finally {
      ROLE_PERMISSIONS.admin = savedAdminPerms;
    }
  });

  test('GET: admin sees customer + partner tickets, envelope + meta', async () => {
    const r = await call('GET', '/?limit=50', { token: admin() });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.data.length, tickets.length);
    assert.deepEqual(new Set(r.body.data.map((x: { requester: { role: string } }) => x.requester.role)), new Set(['customer', 'partner']));
    assert.equal(r.body.meta.total, tickets.length);
  });

  test('GET: filters arrive via the query string (multi-value, empty ignored)', async () => {
    const r = await call('GET', '/?status=open,in_progress&priority=&requesterRole=partner&assignee=unassigned', { token: admin() });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.map((x: { id: string }) => x.id), [String(T.partnerLowOk._id)]);
  });

  test('GET: bad filter -> 400 VALIDATION_ERROR', async () => {
    for (const q of ['?status=bogus', '?sla=late', '?limit=500', '?from=2026-10-09&to=2026-10-01', '?assignee=nope']) {
      const r = await call('GET', `/${q}`, { token: admin() });
      assert.equal(r.status, 400, q);
      assert.equal(r.body.code, 'VALIDATION_ERROR', q);
    }
  });

  test('PATCH assign: success, then unassign, over HTTP', async () => {
    const id = String(T.ghost._id);
    const ok = await call('PATCH', `/${id}/assign`, { token: admin(), json: { assigneeId: String(ADMIN_B) } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.assignee.id, String(ADMIN_B));
    assert.equal(ok.body.message, 'Ticket assigned');
    const un = await call('PATCH', `/${id}/assign`, { token: admin(), json: { assigneeId: null } });
    assert.equal(un.status, 200);
    assert.equal(un.body.data.assignee, null);
    assert.equal(un.body.message, 'Ticket unassigned');
  });

  test('PATCH assign: validation + error mapping (400 / 404 / 409)', async () => {
    const id = String(T.partnerLowOk._id);
    const missing = await call('PATCH', `/${id}/assign`, { token: admin(), json: {} });
    assert.equal(missing.status, 400);
    assert.match(missing.body.details?.[0].field ?? '', /assigneeId/);
    assert.equal((await call('PATCH', `/${id}/assign`, { token: admin(), json: { assigneeId: 'abc' } })).status, 400);
    assert.equal((await call('PATCH', `/not-an-id/assign`, { token: admin(), json: { assigneeId: null } })).status, 400);
    const notAdmin = await call('PATCH', `/${id}/assign`, { token: admin(), json: { assigneeId: String(CUSTOMER) } });
    assert.equal(notAdmin.status, 400);
    const none = await call('PATCH', `/${oid()}/assign`, { token: admin(), json: { assigneeId: null } });
    assert.equal(none.status, 404);
    assert.equal(none.body.code, 'TICKET_NOT_FOUND');
    const closed = await call('PATCH', `/${T.custClosed._id}/assign`, { token: admin(), json: { assigneeId: String(ADMIN_A) } });
    assert.equal(closed.status, 409);
  });
  test('GET ?search= reaches the service (it is not stripped by validation)', async () => {
    const r = await call('GET', '/?search=ramesh', { token: admin() });
    assert.equal(r.status, 200);
    assert.deepEqual(new Set(r.body.data.map((x: { id: string }) => x.id)), idsOf(T.partnerUrgentBreached, T.partnerLowOk));
    const empty = await call('GET', '/?search=', { token: admin() });
    assert.equal(empty.body.data.length, tickets.length);
  });

  describe('GET /admin/ticket-assignees?assignable=true', () => {
    const get = async (qs: string, token?: string) => {
      const res = await fetch(`${staffBase}${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return { status: res.status, body: (await res.json()) as Body };
    };

    test('401 without a token, 403 for customers and partners', async () => {
      assert.equal((await get('?assignable=true')).status, 401);
      for (const role of ['customer', 'partner']) {
        assert.equal((await get('?assignable=true', tokenFor(String(CUSTOMER), role))).status, 403, role);
      }
    });

    test('tickets:manage is required', async () => {
      ROLE_PERMISSIONS.admin = ['payments:read'];
      try {
        const r = await get('?assignable=true', admin());
        assert.equal(r.status, 403);
        assert.equal(r.body.code, 'MISSING_PERMISSION');
      } finally {
        ROLE_PERMISSIONS.admin = savedAdminPerms;
      }
    });

    test('returns active admins as { id, name, email }, in the success envelope, with no secrets', async () => {
      const r = await get('?assignable=true', admin());
      assert.equal(r.status, 200);
      assert.equal(r.body.success, true);
      assert.deepEqual(r.body.data, [
        { id: String(ADMIN_A), name: 'Asha Admin', email: 'asha@hcx.in' },
        { id: String(ADMIN_B), name: 'Bala Admin', email: 'bala@hcx.in' },
      ]);
      assert.ok(!JSON.stringify(r.body).match(/passwordHash|phone|role/));
    });

    test('400 unless assignable=true is asked for explicitly', async () => {
      for (const qs of ['', '?assignable=false', '?assignable=yes']) {
        const r = await get(qs, admin());
        assert.equal(r.status, 400, qs || '(no query)');
        assert.equal(r.body.code, 'VALIDATION_ERROR', qs || '(no query)');
      }
    });
  });
});
