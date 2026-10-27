import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, describe, mock, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware';
import { Availability } from './availability.model';
import availabilityRoutes from './availability.routes';
import { BlackoutDate } from './blackout.model';
import blackoutRoutes from './blackout.routes';
import scheduleRoutes from './schedule.routes';

/**
 * Day 17 negative suite for D01 (availability, working hours, blackout dates, schedule).
 *
 * The REAL routers, auth, role check and validation run over HTTP. There is no database
 * (mongoose buffering is off), so any request that gets past validation and touches the DB
 * fails with a 500 - which makes every 400 below a proof of "rejected before any work".
 * Cases that need a DB answer (404 / 409 / 500) stub the model method and say so.
 */

const secret = process.env.JWT_SECRET || 'dev_access_secret_change_me';
const ME = new Types.ObjectId().toString();
const sign = (role: string, opts: jwt.SignOptions = { expiresIn: '5m' }) => jwt.sign({ sub: ME, role }, secret, opts);
const PARTNER = sign('partner');

const FUTURE = '2099-12-31';
const PAST = '2000-01-01';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const week = () => DAYS.map((day) => ({ day, start: '09:00', end: '18:00', off: false }));

let base = '';
let close: () => Promise<void>;

before(async () => {
  mongoose.set('bufferCommands', false);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/partner/availability', availabilityRoutes);
  app.use('/partner/blackout-dates', blackoutRoutes);
  app.use('/partner/schedule', scheduleRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(async () => close());
afterEach(() => mock.restoreAll());

interface Opts {
  token?: string | null;
  json?: unknown;
  raw?: string;
}
async function call(method: string, path: string, { token = PARTNER, json, raw }: Opts = {}) {
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
  const res = await fetch(base + path, { method, headers, body });
  const text = await res.text();
  let parsed: { message?: string; errors?: unknown; data?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 204 / non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

type Case = { name: string; method: string; path: string; opts?: Opts; status?: number };

/** Each case must return the expected 4xx, never a 500, and always explain itself. */
function run(title: string, cases: Case[]) {
  describe(title, () => {
    for (const c of cases) {
      test(c.name, async () => {
        const r = await call(c.method, c.path, c.opts);
        const want = c.status ?? 400;
        assert.notEqual(r.status, 500, `bad input reached the database / crashed: ${r.text}`);
        assert.equal(r.status, want, `${c.method} ${c.path} -> ${r.status} ${r.text}`);
        assert.equal(typeof r.body.message, 'string', 'error responses must carry a message');
      });
    }
  });
}

const get = (name: string, path: string, extra: Partial<Case> = {}): Case => ({ name, method: 'GET', path, ...extra });
const send = (method: string, name: string, path: string, json: unknown, extra: Partial<Case> = {}): Case => ({
  name,
  method,
  path,
  opts: { json },
  ...extra,
});

/* ---------------- security: auth + role on every route ---------------- */
const ROUTES: [string, string, unknown?][] = [
  ['GET', '/partner/availability'],
  ['PATCH', '/partner/availability', { isOnline: true }],
  ['GET', '/partner/blackout-dates'],
  ['POST', '/partner/blackout-dates', { date: FUTURE, reason: 'Trip' }],
  ['PATCH', `/partner/blackout-dates/${new Types.ObjectId()}`, { reason: 'Trip' }],
  ['DELETE', `/partner/blackout-dates/${new Types.ObjectId()}`],
  ['GET', '/partner/schedule'],
];

describe('security: every D01 route', () => {
  for (const [method, path, json] of ROUTES) {
    const label = `${method} ${path.replace(/[0-9a-f]{24}/, ':id')}`;
    test(`no token -> 401: ${label}`, async () => {
      assert.equal((await call(method, path, { token: null, json })).status, 401);
    });
    test(`garbage token -> 401: ${label}`, async () => {
      assert.equal((await call(method, path, { token: 'not.a.jwt', json })).status, 401);
    });
    test(`expired token -> 401: ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('partner', { expiresIn: -60 }), json })).status, 401);
    });
    test(`token signed with the wrong secret -> 401: ${label}`, async () => {
      const bad = jwt.sign({ sub: ME, role: 'partner' }, 'wrong-secret');
      assert.equal((await call(method, path, { token: bad, json })).status, 401);
    });
    test(`customer token -> 403: ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('customer'), json })).status, 403);
    });
    test(`admin token -> 403: ${label}`, async () => {
      assert.equal((await call(method, path, { token: sign('admin'), json })).status, 403);
    });
  }
});

/* ---------------- availability + working hours ---------------- */
const badDay = (patch: Record<string, unknown>) => {
  const w = week();
  w[0] = { ...w[0], ...patch } as (typeof w)[number];
  return { workingHours: w };
};

run('PATCH /partner/availability (online toggle + working hours)', [
  send('PATCH', 'empty body', '/partner/availability', {}),
  send('PATCH', 'isOnline as string "true"', '/partner/availability', { isOnline: 'true' }),
  send('PATCH', 'isOnline as number', '/partner/availability', { isOnline: 1 }),
  send('PATCH', 'isOnline null', '/partner/availability', { isOnline: null }),
  send('PATCH', 'unknown key (mass assignment of partnerId)', '/partner/availability', { isOnline: true, partnerId: new Types.ObjectId().toString() }),
  send('PATCH', 'unknown key (radius is not accepted here)', '/partner/availability', { radius: 9999 }),
  send('PATCH', 'array body', '/partner/availability', [{ isOnline: true }]),
  send('PATCH', 'null body', '/partner/availability', null),
  { name: 'malformed JSON', method: 'PATCH', path: '/partner/availability', opts: { raw: '{"isOnline": ' } },
  send('PATCH', 'working hours: 6 days only', '/partner/availability', { workingHours: week().slice(0, 6) }),
  send('PATCH', 'working hours: 8 days', '/partner/availability', { workingHours: [...week(), week()[0]] }),
  send('PATCH', 'working hours: empty list', '/partner/availability', { workingHours: [] }),
  send('PATCH', 'working hours: not an array', '/partner/availability', { workingHours: 'always' }),
  send('PATCH', 'working hours: same day twice (7 entries)', '/partner/availability', {
    workingHours: [...week().slice(0, 6), { ...week()[0] }],
  }),
  send('PATCH', 'working hours: unknown day name', '/partner/availability', badDay({ day: 'funday' })),
  send('PATCH', 'working hours: capitalised day name', '/partner/availability', badDay({ day: 'Monday' })),
  send('PATCH', 'working hours: end before start', '/partner/availability', badDay({ start: '18:00', end: '09:00' })),
  send('PATCH', 'working hours: end equals start on a working day', '/partner/availability', badDay({ start: '09:00', end: '09:00' })),
  send('PATCH', 'working hours: 24:00 is not a valid time', '/partner/availability', badDay({ end: '24:00' })),
  send('PATCH', 'working hours: minutes 60', '/partner/availability', badDay({ end: '17:60' })),
  send('PATCH', 'working hours: single-digit hour "9:00"', '/partner/availability', badDay({ start: '9:00' })),
  send('PATCH', 'working hours: 12-hour format', '/partner/availability', badDay({ end: '06:00 PM' })),
  send('PATCH', 'working hours: seconds included', '/partner/availability', badDay({ end: '18:00:00' })),
  send('PATCH', 'working hours: time as number', '/partner/availability', badDay({ start: 900 })),
  send('PATCH', 'working hours: time missing', '/partner/availability', badDay({ start: undefined })),
  send('PATCH', 'working hours: off flag as string', '/partner/availability', badDay({ off: 'yes' })),
  send('PATCH', 'working hours: off flag missing', '/partner/availability', badDay({ off: undefined })),
  send('PATCH', 'working hours: day entry is null', '/partner/availability', { workingHours: [null, ...week().slice(1)] }),
]);

describe('availability: server-side failures are safe', () => {
  test('a database failure returns a generic 500 and never leaks the internal error', async () => {
    mock.method(console, 'error', () => {});
    mock.method(Availability, 'findOneAndUpdate', () => {
      throw new Error('connect ECONNREFUSED mongodb://admin:hunter2@10.0.0.5:27017');
    });
    const r = await call('GET', '/partner/availability');
    assert.equal(r.status, 500);
    assert.equal(r.body.message, 'Something went wrong');
    assert.doesNotMatch(r.text, /hunter2|ECONNREFUSED|mongodb:/);
  });

  test('a valid PATCH that hits a DB failure is a clean 500 with no internals', async () => {
    mock.method(console, 'error', () => {});
    mock.method(Availability, 'findOneAndUpdate', () => {
      throw new Error('boom: secret internals');
    });
    const r = await call('PATCH', '/partner/availability', { json: { isOnline: false } });
    assert.equal(r.status, 500);
    assert.doesNotMatch(r.text, /secret internals/);
  });
});

/* ---------------- blackout dates ---------------- */
const OID = new Types.ObjectId().toString();

run('POST /partner/blackout-dates', [
  send('POST', 'empty body', '/partner/blackout-dates', {}),
  send('POST', 'missing reason', '/partner/blackout-dates', { date: FUTURE }),
  send('POST', 'missing date', '/partner/blackout-dates', { reason: 'Trip' }),
  send('POST', 'date in the past', '/partner/blackout-dates', { date: PAST, reason: 'Trip' }),
  send('POST', 'date format DD-MM-YYYY', '/partner/blackout-dates', { date: '31-12-2099', reason: 'Trip' }),
  send('POST', 'date format with slashes', '/partner/blackout-dates', { date: '2099/12/31', reason: 'Trip' }),
  send('POST', 'full ISO timestamp instead of a date', '/partner/blackout-dates', { date: '2099-12-31T00:00:00Z', reason: 'Trip' }),
  send('POST', 'date as a number', '/partner/blackout-dates', { date: 20991231, reason: 'Trip' }),
  send('POST', 'date null', '/partner/blackout-dates', { date: null, reason: 'Trip' }),
  send('POST', 'impossible date 2099-02-30', '/partner/blackout-dates', { date: '2099-02-30', reason: 'Trip' }),
  send('POST', 'impossible month 2099-13-01', '/partner/blackout-dates', { date: '2099-13-01', reason: 'Trip' }),
  send('POST', 'impossible month 2099-00-10', '/partner/blackout-dates', { date: '2099-00-10', reason: 'Trip' }),
  send('POST', 'impossible day 2099-04-31', '/partner/blackout-dates', { date: '2099-04-31', reason: 'Trip' }),
  send('POST', '29 Feb in a non-leap year', '/partner/blackout-dates', { date: '2099-02-29', reason: 'Trip' }),
  send('POST', 'empty reason', '/partner/blackout-dates', { date: FUTURE, reason: '' }),
  send('POST', 'whitespace-only reason', '/partner/blackout-dates', { date: FUTURE, reason: '     ' }),
  send('POST', 'reason longer than 200 characters', '/partner/blackout-dates', { date: FUTURE, reason: 'x'.repeat(201) }),
  send('POST', 'reason as number', '/partner/blackout-dates', { date: FUTURE, reason: 42 }),
  send('POST', 'reason as object (operator injection)', '/partner/blackout-dates', { date: FUTURE, reason: { $ne: '' } }),
  send('POST', 'date as object (operator injection)', '/partner/blackout-dates', { date: { $gte: '2000-01-01' }, reason: 'Trip' }),
  send('POST', 'unknown key (mass assignment of partnerId)', '/partner/blackout-dates', {
    date: FUTURE,
    reason: 'Trip',
    partnerId: new Types.ObjectId().toString(),
  }),
  send('POST', 'array body', '/partner/blackout-dates', [{ date: FUTURE, reason: 'Trip' }]),
  send('POST', 'null body', '/partner/blackout-dates', null),
  { name: 'malformed JSON', method: 'POST', path: '/partner/blackout-dates', opts: { raw: '{"date": ' } },
  {
    name: 'oversized body -> 413',
    method: 'POST',
    path: '/partner/blackout-dates',
    opts: { json: { date: FUTURE, reason: 'x'.repeat(200_000) } },
    status: 413,
  },
]);

run('PATCH /partner/blackout-dates/:id', [
  send('PATCH', 'empty body', `/partner/blackout-dates/${OID}`, {}),
  send('PATCH', 'empty reason', `/partner/blackout-dates/${OID}`, { reason: '' }),
  send('PATCH', 'whitespace-only reason', `/partner/blackout-dates/${OID}`, { reason: '   ' }),
  send('PATCH', 'reason too long', `/partner/blackout-dates/${OID}`, { reason: 'x'.repeat(201) }),
  send('PATCH', 'reason as number', `/partner/blackout-dates/${OID}`, { reason: 5 }),
  send('PATCH', 'trying to move the date (fixed once created)', `/partner/blackout-dates/${OID}`, { reason: 'ok', date: FUTURE }),
  send('PATCH', 'trying to reassign partnerId', `/partner/blackout-dates/${OID}`, { reason: 'ok', partnerId: OID }),
  send('PATCH', 'malformed id', '/partner/blackout-dates/not-an-id', { reason: 'ok' }),
  send('PATCH', 'id too short', '/partner/blackout-dates/123', { reason: 'ok' }),
  send('PATCH', 'id with operator characters', '/partner/blackout-dates/%7B%22$ne%22:1%7D', { reason: 'ok' }),
]);

run('DELETE /partner/blackout-dates/:id', [
  { name: 'malformed id', method: 'DELETE', path: '/partner/blackout-dates/not-an-id' },
  { name: 'id too short', method: 'DELETE', path: '/partner/blackout-dates/123' },
  { name: 'id one character too long', method: 'DELETE', path: `/partner/blackout-dates/${OID}0` },
  { name: 'DELETE on the collection is not routed -> 404', method: 'DELETE', path: '/partner/blackout-dates', status: 404 },
]);

describe('blackout dates: database outcomes', () => {
  test('PATCH an id that does not exist (or belongs to another partner) -> 404', async () => {
    mock.method(BlackoutDate, 'findOneAndUpdate', (() => Promise.resolve(null)) as never);
    const r = await call('PATCH', `/partner/blackout-dates/${OID}`, { json: { reason: 'Trip' } });
    assert.equal(r.status, 404);
    assert.equal(r.body.message, 'Blackout date not found');
  });

  test('DELETE an id that does not exist (or belongs to another partner) -> 404', async () => {
    mock.method(BlackoutDate, 'findOneAndDelete', (() => Promise.resolve(null)) as never);
    const r = await call('DELETE', `/partner/blackout-dates/${OID}`);
    assert.equal(r.status, 404);
  });

  test('another partner cannot touch this blackout: the query is always scoped by the signed-in partner', async () => {
    let filter: Record<string, unknown> = {};
    mock.method(BlackoutDate, 'findOneAndDelete', ((f: Record<string, unknown>) => {
      filter = f;
      return Promise.resolve(null);
    }) as never);
    await call('DELETE', `/partner/blackout-dates/${OID}`);
    assert.equal(String(filter.partnerId), ME);
    assert.equal(String(filter._id), OID);
  });

  test('adding a date that already has a blackout -> 409', async () => {
    mock.method(BlackoutDate, 'create', (() =>
      Promise.reject(new MongoServerError({ message: 'E11000 duplicate key', code: 11000 }))) as never);
    const r = await call('POST', '/partner/blackout-dates', { json: { date: FUTURE, reason: 'Trip' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, 'A blackout date already exists for that day');
  });

  test('a database failure on create is a generic 500 with no internals', async () => {
    mock.method(console, 'error', () => {});
    mock.method(BlackoutDate, 'create', (() => Promise.reject(new Error('E11000 index partnerId_1_date_1 secret'))) as never);
    const r = await call('POST', '/partner/blackout-dates', { json: { date: FUTURE, reason: 'Trip' } });
    assert.equal(r.status, 500);
    assert.equal(r.body.message, 'Something went wrong');
    assert.doesNotMatch(r.text, /secret|partnerId_1/);
  });

  test('empty state: no blackout dates -> 200 with an empty list', async () => {
    mock.method(BlackoutDate, 'find', (() => ({ sort: () => Promise.resolve([]) })) as never);
    const r = await call('GET', '/partner/blackout-dates');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, []);
  });
});

/* ---------------- schedule ---------------- */
run('GET /partner/schedule', [
  get('from is not a date', '/partner/schedule?from=tomorrow'),
  get('to is not a date', '/partner/schedule?to=next-week'),
  get('from in DD-MM-YYYY', '/partner/schedule?from=31-12-2099'),
  get('from as a timestamp', '/partner/schedule?from=2099-12-31T00:00:00Z'),
  get('impossible from 2099-02-30', '/partner/schedule?from=2099-02-30'),
  get('impossible to 2099-13-45', '/partner/schedule?to=2099-13-45'),
  get('from after to', '/partner/schedule?from=2099-12-31&to=2099-01-01'),
  get('from repeated (array)', '/partner/schedule?from=2099-01-01&from=2099-01-02'),
  get('from as operator injection', '/partner/schedule?from[$gte]=2000-01-01'),
  get('empty from', '/partner/schedule?from='),
]);

describe('schedule: states', () => {
  test('empty state: a partner with no availability or blackouts gets 200 with an offline, empty calendar', async () => {
    mock.method(Availability, 'findOne', (() => Promise.resolve(null)) as never);
    mock.method(BlackoutDate, 'find', (() => ({ sort: () => Promise.resolve([]) })) as never);
    const r = await call('GET', '/partner/schedule?from=2099-01-01&to=2099-01-31');
    assert.equal(r.status, 200);
    const d = r.body.data as { isOnline: boolean; workingHours: unknown[]; blackoutDates: unknown[]; jobs: unknown[] };
    assert.equal(d.isOnline, false);
    assert.deepEqual(d.workingHours, []);
    assert.deepEqual(d.blackoutDates, []);
    assert.deepEqual(d.jobs, []);
  });

  test('from equal to to (a single day) is allowed', async () => {
    mock.method(Availability, 'findOne', (() => Promise.resolve(null)) as never);
    mock.method(BlackoutDate, 'find', (() => ({ sort: () => Promise.resolve([]) })) as never);
    const r = await call('GET', '/partner/schedule?from=2099-01-01&to=2099-01-01');
    assert.equal(r.status, 200);
  });

  test('a database failure is a generic 500 with no internals', async () => {
    mock.method(console, 'error', () => {});
    mock.method(Availability, 'findOne', (() => Promise.reject(new Error('replica set secret'))) as never);
    const r = await call('GET', '/partner/schedule');
    assert.equal(r.status, 500);
    assert.doesNotMatch(r.text, /secret|replica/);
  });

  test('the calendar only ever queries the signed-in partner', async () => {
    let avail: Record<string, unknown> = {};
    let black: Record<string, unknown> = {};
    mock.method(Availability, 'findOne', ((f: Record<string, unknown>) => {
      avail = f;
      return Promise.resolve(null);
    }) as never);
    mock.method(BlackoutDate, 'find', ((f: Record<string, unknown>) => {
      black = f;
      return { sort: () => Promise.resolve([]) };
    }) as never);
    await call('GET', `/partner/schedule?from=2099-01-01&to=2099-01-31&partnerId=${new Types.ObjectId()}`);
    assert.equal(String(avail.partnerId), ME);
    assert.equal(String(black.partnerId), ME);
  });
});
