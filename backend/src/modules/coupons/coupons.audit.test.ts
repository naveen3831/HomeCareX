
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Types } from 'mongoose';

import { CouponsService } from './coupons.service';
import { couponsRepository } from './coupons.repository';
import { auditService } from '../audit/audit.service';

const service = new CouponsService();

const actor = {
  id: new Types.ObjectId().toString(),
  ip: '127.0.0.1',
};

const couponId = new Types.ObjectId().toString();

const makeCoupon = (overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  return {
    _id: new Types.ObjectId(couponId),
    code: 'SAVE10',
    type: 'PERCENT' as const,
    value: 10,
    maxDiscount: null,
    minOrder: 0,
    startAt: new Date(now.getTime() - 60_000),
    endAt: new Date(now.getTime() + 86_400_000),
    totalLimit: null,
    perUserLimit: null,
    usedCount: 0,
    categoryIds: [],
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const validInput = {
  code: 'SAVE10',
  type: 'PERCENT' as const,
  value: 10,
  minOrder: 0,
  startAt: new Date(Date.now() - 60_000),
  endAt: new Date(Date.now() + 86_400_000),
  categoryIds: [],
  active: true,
};

const original = {
  findByCode: couponsRepository.findByCode,
  findById: couponsRepository.findById,
  create: couponsRepository.create,
  update: couponsRepository.update,
  remove: couponsRepository.remove,
  recordAudit: auditService.recordAudit,
};

afterEach(() => {
  couponsRepository.findByCode = original.findByCode;
  couponsRepository.findById = original.findById;
  couponsRepository.create = original.create;
  couponsRepository.update = original.update;
  couponsRepository.remove = original.remove;
  auditService.recordAudit = original.recordAudit;
});

test('coupon creation records actor, IP and after snapshot', async () => {
  let recorded: any;

  couponsRepository.findByCode = async () => null as any;
  couponsRepository.create = async () => makeCoupon() as any;
  auditService.recordAudit = async (input: any) => {
    recorded = input;
    return input;
  };

  const result = await service.create(validInput, actor);

  assert.equal(result.code, 'SAVE10');
  assert.equal(recorded.action, 'coupon.created');
  assert.equal(recorded.entity, 'Coupon');
  assert.equal(recorded.entityId, result.id);
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before, null);
  assert.equal(recorded.after.code, result.code);
});

test('coupon update records before and after snapshots', async () => {
  let recorded: any;
  const before = makeCoupon();
  const after = makeCoupon({ value: 20 });

  couponsRepository.findById = async () => before as any;
  couponsRepository.findByCode = async () => null as any;
  couponsRepository.update = async () => after as any;
  auditService.recordAudit = async (input: any) => {
    recorded = input;
    return input;
  };

  const result = await service.update(couponId, { value: 20 }, actor);

  assert.equal(result.value, 20);
  assert.equal(recorded.action, 'coupon.updated');
  assert.equal(recorded.entityId, couponId);
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before.value, 10);
  assert.equal(recorded.after.value, 20);
});

test('coupon deletion records the previous snapshot', async () => {
  let recorded: any;

  couponsRepository.findById = async () => makeCoupon() as any;
  couponsRepository.remove = async () => makeCoupon() as any;
  auditService.recordAudit = async (input: any) => {
    recorded = input;
    return input;
  };

  await service.remove(couponId, actor);

  assert.equal(recorded.action, 'coupon.deleted');
  assert.equal(recorded.entity, 'Coupon');
  assert.equal(recorded.entityId, couponId);
  assert.equal(recorded.actor, actor.id);
  assert.equal(recorded.ip, actor.ip);
  assert.equal(recorded.result, 'Success');
  assert.equal(recorded.before.code, 'SAVE10');
  assert.equal(recorded.after, null);
});

test('successful coupon creation is not undone if audit recording fails', async () => {
  couponsRepository.findByCode = async () => null as any;
  couponsRepository.create = async () => makeCoupon() as any;
  auditService.recordAudit = async () => {
    throw new Error('Audit storage unavailable');
  };

  const result = await service.create(validInput, actor);

  assert.equal(result.code, 'SAVE10');
});
