import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

/* eslint-disable @typescript-eslint/no-require-imports */
const app = require('../../app').default as import('express').Express;
const { sosRepository: repo } = require('./sos.repository') as typeof import('./sos.repository');
const { auditService } = require('../audit/audit.service') as typeof import('../audit/audit.service');
/* eslint-enable @typescript-eslint/no-require-imports */

type Row = import('./sos.repository').SosRowRaw;

const partnerUserId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId().toString();
const ownBooking = new Types.ObjectId().toString();
const otherBooking = new Types.ObjectId().toString();
const token = (role: string, sub = partnerUserId) => jwt.sign({ sub, role }, 'test_secret', { expiresIn: '5m' });

let rows: Row[];
let audits: Array<{ action: string; actor: string; entityId: string }>;
let server: Server;
let base: string;

const post = (bearer?: string, body: unknown = {}) =>
  fetch(`${base}/api/v1/partner/safety/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
const data = async (res: Response) => ((await res.json()) as { data: { alert: Row & { triggeredAt: string }; duplicate: boolean } }).data;

describe('partner SOS', () => {
  before(() => {
    repo.findPartnerIdByUserId = (async (id: string) => (id === partnerUserId ? partnerId : null)) as typeof repo.findPartnerIdByUserId;
    repo.bookingBelongsToPartner = (async (b: string) => b === ownBooking) as typeof repo.bookingBelongsToPartner;
    repo.findRecentActive = (async (_p: string, since: Date) =>
      rows.find((r) => r.status === 'active' && r.triggeredAt >= since) ?? null) as typeof repo.findRecentActive;
    repo.create = (async (i) => {
      const row: Row = { id: new Types.ObjectId().toString(), partnerId: i.partnerId, bookingId: i.bookingId, location: i.location, status: 'active', triggeredAt: i.triggeredAt };
      rows.push(row);
      return row;
    }) as typeof repo.create;
    auditService.recordAudit = (async (i: { action: string; actor: string; entityId: string }) => {
      audits.push(i);
      return {};
    }) as unknown as typeof auditService.recordAudit;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());
  beforeEach(() => {
    rows = [];
    audits = [];
  });

  it('creates an alert with no job and no location (Safety page, permission denied)', async () => {
    const res = await post(token('partner'));
    assert.equal(res.status, 201);
    const d = await data(res);
    assert.equal(d.duplicate, false);
    assert.equal(d.alert.status, 'active');
    assert.equal(d.alert.bookingId, null);
    assert.equal(d.alert.location, null);
    assert.equal(rows.length, 1);
  });

  it('stores location and own booking, and writes an audit entry', async () => {
    const res = await post(token('partner'), { bookingId: ownBooking, location: { lat: 16.5, lng: 80.6, accuracy: 9 } });
    assert.equal(res.status, 201);
    const d = await data(res);
    assert.equal(d.alert.bookingId, ownBooking);
    assert.deepEqual(d.alert.location, { lat: 16.5, lng: 80.6, accuracy: 9 });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'partner.sos.triggered');
    assert.equal(audits[0].actor, partnerUserId);
    assert.equal(audits[0].entityId, d.alert.id);
  });

  it('a second press inside 60 s returns the same alert and does not create or audit again', async () => {
    const first = await data(await post(token('partner')));
    const res = await post(token('partner'));
    assert.equal(res.status, 200);
    const second = await data(res);
    assert.equal(second.duplicate, true);
    assert.equal(second.alert.id, first.alert.id);
    assert.equal(rows.length, 1);
    assert.equal(audits.length, 1);
  });

  it('404 when the booking is not assigned to this partner, and nothing is saved', async () => {
    const res = await post(token('partner'), { bookingId: otherBooking });
    assert.equal(res.status, 404);
    assert.equal(rows.length, 0);
  });

  it('400 for bad coordinates, a bad booking id, or unknown fields (partnerId is never accepted)', async () => {
    const t = token('partner');
    assert.equal((await post(t, { location: { lat: 91, lng: 0 } })).status, 400);
    assert.equal((await post(t, { location: { lat: 1 } })).status, 400);
    assert.equal((await post(t, { bookingId: 'nope' })).status, 400);
    assert.equal((await post(t, { partnerId })).status, 400);
    assert.equal(rows.length, 0);
  });

  it('401 without a token, 403 for a customer', async () => {
    assert.equal((await post()).status, 401);
    assert.equal((await post(token('customer'))).status, 403);
    assert.equal(rows.length, 0);
  });

  it('still succeeds when the audit write fails', async () => {
    const original = auditService.recordAudit;
    auditService.recordAudit = (async () => {
      throw new Error('audit down');
    }) as unknown as typeof auditService.recordAudit;
    try {
      assert.equal((await post(token('partner'))).status, 201);
      assert.equal(rows.length, 1);
    } finally {
      auditService.recordAudit = original;
    }
  });
});
