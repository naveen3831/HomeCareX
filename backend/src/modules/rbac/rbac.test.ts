import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { RoleModel } from '../../models/Role';
import { StaffModel } from '../../models/Staff';
import { requirePermission, requireResourceAccess } from '../../middleware/permission.middleware';
import { auditService } from '../audit/audit.service';
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES, actionFor, validateRoleInput } from './rbac.constants';
import { rbacPermissions } from './rbac.permissions';
import { rbacRolesService } from './rbac.roles.service';

const actor = { id: 'u1', ip: '1.1.1.1' };

/* ---------- pure rules ---------- */
test('6 system roles, every permission is in the catalog, and routes’ required keys exist', () => {
  assert.equal(SYSTEM_ROLES.length, 6);
  for (const r of SYSTEM_ROLES) for (const p of r.permissions) assert.ok(p === '*' || ALL_PERMISSION_KEYS.has(p), `${r.key}: ${p}`);
  for (const k of ['payments:read', 'tickets:manage', 'pricing:manage', 'settings:manage', 'reviews:moderate', 'roles:view', 'staff:view']) assert.ok(ALL_PERMISSION_KEYS.has(k), k);
  assert.ok(!SYSTEM_ROLES.find((r) => r.key === 'admin')!.permissions.some((p) => p.startsWith('roles:') || p.startsWith('staff:')));
});

test('role input: name, permissions and unknown keys are validated', () => {
  assert.equal(validateRoleInput({ name: 'A', permissions: ['bookings:view'] }, { partial: false }).ok, false);
  assert.equal(validateRoleInput({ name: 'Auditor', permissions: [] }, { partial: false }).ok, false);
  assert.equal(validateRoleInput({ name: 'Auditor', permissions: ['bookings:fly'] }, { partial: false }).ok, false);
  assert.equal(validateRoleInput({ name: 'Auditor', permissions: ['*'] }, { partial: false }).ok, false); // '*' is Super Admin only
  assert.deepEqual(validateRoleInput({ name: ' Auditor ', permissions: ['audit:view', 'audit:view'] }, { partial: false }), { ok: true, value: { name: 'Auditor', description: '', permissions: ['audit:view'] } });
  assert.deepEqual(validateRoleInput({ description: 'x' }, { partial: true }), { ok: true, value: { description: 'x' } });
});

test('method -> action falls back to manage / update for resources that lack create/delete', () => {
  assert.equal(actionFor('customers', 'GET'), 'view');
  assert.equal(actionFor('coupons', 'POST'), 'create');
  assert.equal(actionFor('coupons', 'DELETE'), 'delete');
  assert.equal(actionFor('catalog', 'POST'), 'manage');
  assert.equal(actionFor('partners', 'POST'), 'update');
});

/* ---------- roles service on in-memory fakes ---------- */
let roles: Map<string, Record<string, unknown>>;
let staff: { userId: string; roleId: string }[];
let audits: Record<string, unknown>[];
const orig = { r: { ...RoleModel } as Record<string, unknown>, s: StaffModel.find, audit: auditService.recordAudit };
const chain = <T,>(rows: T) => ({ sort: () => chain(rows), select: () => chain(rows), lean: async () => rows });

beforeEach(() => {
  // ensureSystemRoles() only seeds once per process, so put the 6 system roles in the fake store directly.
  roles = new Map(SYSTEM_ROLES.map((r) => [r.id, { _id: r.id, key: r.key, name: r.name, description: r.description, permissions: r.permissions, isSystem: true }]));
  staff = [];
  audits = [];
  const R = RoleModel as unknown as Record<string, unknown>;
  R.bulkWrite = async (ops: { updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }[]) => {
    for (const o of ops) roles.set(o.updateOne.filter._id, { _id: o.updateOne.filter._id, ...o.updateOne.update.$set });
  };
  R.find = () => chain([...roles.values()]);
  R.findById = (id: string) => chain(roles.has(id) ? structuredClone(roles.get(id)) : null); // a real DB hands back copies
  R.create = async (doc: Record<string, unknown>) => {
    if ([...roles.values()].some((r) => String(r.name).toLowerCase() === String(doc.name).toLowerCase())) throw Object.assign(new Error('dup'), { code: 11000 });
    roles.set(String(doc._id), doc);
    return { toObject: () => doc };
  };
  R.updateOne = async (f: { _id: string }, u: { $set: Record<string, unknown> }) => void Object.assign(roles.get(f._id)!, u.$set);
  R.deleteOne = async (f: { _id: string }) => void roles.delete(f._id);
  StaffModel.find = (() => chain(staff)) as never;
  (auditService as unknown as { recordAudit: unknown }).recordAudit = async (i: Record<string, unknown>) => void audits.push(i);
});
afterEach(() => {
  Object.assign(RoleModel, orig.r);
  StaffModel.find = orig.s;
  (auditService as unknown as { recordAudit: unknown }).recordAudit = orig.audit;
});

test('list returns the 6 system roles with member counts', async () => {
  staff = [{ userId: 'a', roleId: 'role_finance' }, { userId: 'b', roleId: 'role_finance' }];
  const list = await rbacRolesService.list();
  assert.equal(list.filter((r) => r.isSystem).length, 6);
  assert.equal(list.find((r) => r.id === 'role_finance')!.memberCount, 2);
});

test('create: custom role is saved and audited; duplicate name is 409; bad input is 422 with fields', async () => {
  const made = await rbacRolesService.create({ name: 'Auditor', permissions: ['audit:view'] }, actor);
  assert.equal(made.isSystem, false);
  assert.match(made.id, /^role_/);
  assert.equal(audits[0].action, 'role.created');
  await assert.rejects(() => rbacRolesService.create({ name: 'auditor', permissions: ['audit:view'] }, actor), { status: 409, code: 'ROLE_NAME_TAKEN' });
  await assert.rejects(() => rbacRolesService.create({ name: 'X', permissions: ['nope:nope'] }, actor), (e: { status: number; details: { field: string }[] }) => e.status === 422 && e.details.length === 2);
});

test('system roles can’t be edited or deleted (403)', async () => {
  await assert.rejects(() => rbacRolesService.update('role_admin', { name: 'Hacked' }, actor), { status: 403, code: 'SYSTEM_ROLE_PROTECTED' });
  await assert.rejects(() => rbacRolesService.remove('role_super_admin', actor), { status: 403, code: 'SYSTEM_ROLE_PROTECTED' });
});

test('update changes permissions and audits before/after; delete is blocked while the role has members (409)', async () => {
  const { id } = await rbacRolesService.create({ name: 'Auditor', permissions: ['audit:view'] }, actor);
  const updated = await rbacRolesService.update(id, { permissions: ['audit:view', 'audit:export'] }, actor);
  assert.deepEqual(updated.permissions, ['audit:view', 'audit:export']);
  const row = audits.find((a) => a.action === 'role.updated')!;
  assert.deepEqual((row.before as { permissions: string[] }).permissions, ['audit:view']);

  staff = [{ userId: 'a', roleId: id }];
  await assert.rejects(() => rbacRolesService.remove(id, actor), { status: 409, code: 'ROLE_IN_USE' });
  staff = [];
  await rbacRolesService.remove(id, actor);
  assert.equal(roles.has(id), false);
  assert.equal(audits.at(-1)!.action, 'role.deleted');
});

test('assertExists rejects unknown and non-string role ids', async () => {
  await rbacRolesService.assertExists('role_finance');
  await assert.rejects(() => rbacRolesService.assertExists('role_nope'), { status: 422 });
  await assert.rejects(() => rbacRolesService.assertExists(undefined), { status: 422 });
});

/* ---------- server-side enforcement ---------- */
const run = (mw: ReturnType<typeof requirePermission>, auth: object, method = 'GET') =>
  new Promise<unknown>((resolve) => mw({ method } as Request, { locals: { auth } } as unknown as Response, ((e?: unknown) => resolve(e)) as NextFunction));
const realResolve = rbacPermissions.resolveAdminPermissions;
afterEach(() => { rbacPermissions.resolveAdminPermissions = realResolve; });

test('an admin whose staff role lacks the permission gets 403; with it, access; no database keeps the static rule', async () => {
  rbacPermissions.resolveAdminPermissions = async () => ['bookings:view'];
  assert.equal(await run(requirePermission('bookings:view'), { sub: 'u', role: 'admin' }), undefined);
  assert.equal(((await run(requirePermission('settings:manage'), { sub: 'u', role: 'admin' })) as { status: number }).status, 403);
  rbacPermissions.resolveAdminPermissions = async () => [];                    // deactivated staff
  assert.equal(((await run(requirePermission('bookings:view'), { sub: 'u', role: 'admin' })) as { status: number }).status, 403);
  rbacPermissions.resolveAdminPermissions = async () => ['*'];                 // super admin
  assert.equal(await run(requirePermission('settings:manage'), { sub: 'u', role: 'admin' }), undefined);
  rbacPermissions.resolveAdminPermissions = async () => null;                  // no DB
  assert.equal(await run(requirePermission('settings:manage'), { sub: 'u', role: 'admin' }), undefined);
});

test('requireResourceAccess: GET needs view, writes need the write action', async () => {
  rbacPermissions.resolveAdminPermissions = async () => ['catalog:view'];
  assert.equal(await run(requireResourceAccess('catalog'), { sub: 'u', role: 'admin' }, 'GET'), undefined);
  const denied = (await run(requireResourceAccess('catalog'), { sub: 'u', role: 'admin' }, 'POST')) as { status: number; message: string };
  assert.equal(denied.status, 403);
  assert.match(denied.message, /catalog:manage/);
});
