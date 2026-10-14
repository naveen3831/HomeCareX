import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Types } from 'mongoose';
import DefaultTicketModel, { TicketModel } from './Ticket';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../modules/tickets/tickets.constants';

// The admin-tickets tests stub the repository, so they cannot notice a broken model import.
// This guards the real thing: the export exists, and its schema matches the D02 contract the queue reads.
describe('Ticket model (D02 contract)', () => {
  test('exports a usable model as both named and default export', () => {
    assert.equal(typeof TicketModel.find, 'function');
    assert.equal(DefaultTicketModel, TicketModel);
  });

  test('has every field the admin queue reads, and none of the legacy SLA fields', () => {
    const paths = Object.keys(TicketModel.schema.paths);
    for (const p of ['createdBy', 'createdByRole', 'bookingId', 'category', 'subject', 'status', 'priority', 'assignedTo', 'lastMessageAt', 'createdAt', 'updatedAt']) {
      assert.ok(paths.includes(p), `missing ${p}`);
    }
    for (const p of ['ticketNumber', 'requesterType', 'slaDueAt']) assert.ok(!paths.includes(p), `legacy ${p} still present`);
  });

  test('defaults match the contract and the minimal create() used by scripts validates', () => {
    const t = new TicketModel({ createdBy: new Types.ObjectId(), createdByRole: 'partner', category: 'payment', subject: 'x' });
    assert.equal(t.validateSync(), undefined);
    assert.equal(t.status, 'open');
    assert.equal(t.priority, 'normal');
    assert.ok(t.lastMessageAt instanceof Date);
    assert.equal(t.assignedTo, null);
  });

  test('enums come from tickets.constants', () => {
    assert.deepEqual([...TicketModel.schema.path('status').options.enum], [...TICKET_STATUSES]);
    assert.deepEqual([...TicketModel.schema.path('priority').options.enum], [...TICKET_PRIORITIES]);
    const bad = new TicketModel({ createdBy: new Types.ObjectId(), createdByRole: 'customer', category: 'payment', subject: 'x', priority: 'medium' });
    assert.ok(bad.validateSync()?.errors.priority);
  });
});
