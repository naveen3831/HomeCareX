
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Types } from 'mongoose';

import { PartnersService } from './partners.service';
import { UserModel } from '../../models/User';
import PartnerModel from '../../models/Partner';
import { NotificationModel } from '../../models/Notification';
import BookingModel from '../../models/Booking';
import { auditService } from '../audit/audit.service';
import { designationsService } from '../designations/designations.service';
import { mailService } from '../../services/mail.service';

const service = new PartnersService();

const actor = {
  id: new Types.ObjectId().toString(),
  ip: '127.0.0.1',
};

const partnerId = new Types.ObjectId();

const makeUser = (overrides: Record<string, any> = {}) => ({
  _id: partnerId,
  id: partnerId.toString(),
  name: 'Test Partner',
  email: 'partner@example.com',
  phone: '9876543210',
  gender: 'other',
  designation: 'Electrician',
  status: 'active',
  role: 'partner',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tokenVersion: 0,
  save: async function () {
    return this;
  },
  deleteOne: async () => ({}),
  ...overrides,
});

const original = {
  exists: UserModel.exists,
  findOne: UserModel.findOne,
  create: UserModel.create,
  partnerFindOneAndUpdate: PartnerModel.findOneAndUpdate,
  partnerFindOne: PartnerModel.findOne,
  partnerDeleteOne: PartnerModel.deleteOne,
  notificationDeleteMany: NotificationModel.deleteMany,
  bookingExists: BookingModel.exists,
  recordAudit: auditService.recordAudit,
  canonical: designationsService.canonical,
  sendPartnerCredentials: mailService.sendPartnerCredentials,
  consoleError: console.error,
};

afterEach(() => {
  UserModel.exists = original.exists;
  UserModel.findOne = original.findOne;
  UserModel.create = original.create;
  PartnerModel.findOneAndUpdate = original.partnerFindOneAndUpdate;
  PartnerModel.findOne = original.partnerFindOne;
  PartnerModel.deleteOne = original.partnerDeleteOne;
  NotificationModel.deleteMany = original.notificationDeleteMany;
  BookingModel.exists = original.bookingExists;
  auditService.recordAudit = original.recordAudit;
  designationsService.canonical = original.canonical;
  mailService.sendPartnerCredentials = original.sendPartnerCredentials;
  console.error = original.consoleError;
});

test('partner creation records actor, IP and safe after snapshot', async () => {
  let recorded: any;

  const user = makeUser();

  UserModel.exists = (async () => null) as any;
  designationsService.canonical = (async () => 'Electrician') as any;
  UserModel.create = (async () => user) as any;
  PartnerModel.findOneAndUpdate = (async () => ({})) as any;
  mailService.sendPartnerCredentials = (async () => undefined) as any;

  auditService.recordAudit = (async (input: any) => {
    recorded = input;
    return input;
  }) as any;

  const result = await service.create(
    {
      name: 'Test Partner',
      email: 'partner@example.com',
      phone: '9876543210',
      gender: 'other',
      designation: 'Electrician',
      password: 'TestPassword123!',
    } as any,
    actor,
  );

  assert.equal(result.partner.id, partnerId.toString());
  assert.equal(recorded.action, 'partner.created');
  assert.equal(recorded.entity, 'Partner');
  assert.equal(recorded.entityId, partnerId.toString());
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before, null);
  assert.equal(recorded.after.email, 'partner@example.com');
  assert.equal('password' in recorded.after, false);
  assert.equal('passwordHash' in recorded.after, false);
  assert.equal('tokenVersion' in recorded.after, false);
});

test('partner update records before and after snapshots', async () => {
  let recorded: any;

  const user = makeUser();

  UserModel.findOne = (async () => user) as any;
  PartnerModel.findOneAndUpdate = (async () => ({})) as any;

  auditService.recordAudit = (async (input: any) => {
    recorded = input;
    return input;
  }) as any;

  await service.update(
    partnerId.toString(),
    { name: 'Updated Partner' } as any,
    actor,
  );

  assert.equal(recorded.action, 'partner.updated');
  assert.equal(recorded.entity, 'Partner');
  assert.equal(recorded.entityId, partnerId.toString());
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before.name, 'Test Partner');
  assert.equal(recorded.after.name, 'Updated Partner');
  assert.equal('passwordHash' in recorded.before, false);
  assert.equal('passwordHash' in recorded.after, false);
});

test('partner deletion records previous snapshot', async () => {
  let recorded: any;

  const user = makeUser();

  UserModel.findOne = (async () => user) as any;

  PartnerModel.findOne = (() => ({
    lean: async () => null,
  })) as any;

  NotificationModel.deleteMany = (async () => ({ deletedCount: 0 })) as any;

  auditService.recordAudit = (async (input: any) => {
    recorded = input;
    return input;
  }) as any;

  await service.remove(partnerId.toString(), actor);

  assert.equal(recorded.action, 'partner.deleted');
  assert.equal(recorded.entity, 'Partner');
  assert.equal(recorded.entityId, partnerId.toString());
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before.name, 'Test Partner');
  assert.equal(recorded.after, null);
  assert.equal('passwordHash' in recorded.before, false);
});

test('partner creation succeeds if audit storage fails', async () => {
  const user = makeUser();

  UserModel.exists = (async () => null) as any;
  designationsService.canonical = (async () => 'Electrician') as any;
  UserModel.create = (async () => user) as any;
  PartnerModel.findOneAndUpdate = (async () => ({})) as any;
  mailService.sendPartnerCredentials = (async () => undefined) as any;
  console.error = () => undefined;

  auditService.recordAudit = (async () => {
    throw new Error('Audit storage unavailable');
  }) as any;

  const result = await service.create(
    {
      name: 'Test Partner',
      email: 'partner@example.com',
      phone: '9876543210',
      gender: 'other',
      designation: 'Electrician',
      password: 'TestPassword123!',
    } as any,
    actor,
  );

  assert.equal(result.partner.id, partnerId.toString());
});
