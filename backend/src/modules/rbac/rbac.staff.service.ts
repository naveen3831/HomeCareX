import { isValidObjectId } from 'mongoose';

import { StaffModel, type StaffStatusValue } from '../../models/Staff';
import { UserModel } from '../../models/User';
import { auditService } from '../audit/audit.service';
import { authService } from '../auth/auth.service';
import { HttpError } from '../auth/auth.types';
import { SUPER_ADMIN_ROLE_ID } from './rbac.constants';
import { rbacPermissions } from './rbac.permissions';
import { rbacRolesService } from './rbac.roles.service';

export { SUPER_ADMIN_ROLE_ID };

type RoleLabels = Awaited<ReturnType<typeof rbacRolesService.labels>>;

interface StaffDoc {
  userId: unknown;
  name: string;
  email: string;
  roleId: string;
  status: StaffStatusValue;
}

/** The API `id` is the login account id (userId): role change, logout-all and "(you)" all key on it. */
function toStaff(s: StaffDoc, labels: RoleLabels, lastLoginAt?: Date | null) {
  const label = labels.get(s.roleId);
  return {
    id: String(s.userId),
    name: s.name,
    email: s.email,
    roleId: s.roleId,
    roleName: label?.name ?? s.roleId,
    roleKey: label?.key,
    status: s.status,
    lastLoginAt: lastLoginAt ? new Date(lastLoginAt).toISOString() : null,
  };
}

/**
 * Admin accounts created before the staff collection existed (e.g. the seeded admin) get a staff
 * record the first time the team is read. They become Super Admins unless an old invite named a role.
 */
async function syncAdminsToStaff() {
  const admins = await UserModel.find({ role: 'admin' }).select('name email status staffRoleId').lean();
  if (!admins.length) return;
  const have = new Set((await StaffModel.find({ userId: { $in: admins.map((a) => a._id) } }).select('userId').lean()).map((s) => String(s.userId)));
  const missing = admins.filter((a) => !have.has(String(a._id)));
  if (!missing.length) return;
  try {
    await StaffModel.insertMany(
      missing.map((a) => ({
        userId: a._id,
        name: a.name,
        email: a.email,
        roleId: a.staffRoleId || SUPER_ADMIN_ROLE_ID,
        status: a.status === 'blocked' ? 'deactivated' : a.status === 'invited' ? 'invited' : 'active',
      })),
      { ordered: false },
    );
  } catch (err) {
    // A parallel request may have inserted the same rows first (unique index): safe to ignore.
    console.warn('[rbac] staff backfill skipped some rows', (err as Error).message);
  }
}

const activeSuperAdminCount = () => StaffModel.countDocuments({ status: 'active', roleId: SUPER_ADMIN_ROLE_ID });

async function findStaff(userId: string) {
  if (!isValidObjectId(userId)) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
  await syncAdminsToStaff();
  const staff = await StaffModel.findOne({ userId });
  if (!staff) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
  return staff;
}

async function lastLoginOf(userId: unknown) {
  const u = await UserModel.findById(userId).select('lastLoginAt').lean();
  return u?.lastLoginAt ?? null;
}

async function audit(actor: { id: string; ip: string }, action: string, targetId: string, before: unknown, after: unknown) {
  try {
    await auditService.recordAudit({ actor: actor.id, action, entity: 'staff', entityId: targetId, before, after, ip: actor.ip, result: 'Success' });
  } catch (err) {
    // The change itself already happened; never fail the request because the audit write failed.
    console.error(`[rbac] audit write failed for ${action} on ${targetId}`, err);
  }
}

const LAST_SUPER_ADMIN = () =>
  new HttpError(409, 'You can’t remove the last Super Admin. Make someone else a Super Admin first.', 'LAST_SUPER_ADMIN');

export const rbacStaffService = {
  /** GET /admin/staff */
  async list() {
    await syncAdminsToStaff();
    const staff = await StaffModel.find().sort({ createdAt: -1 }).lean();
    const users = await UserModel.find({ _id: { $in: staff.map((s) => s.userId) } }).select('lastLoginAt').lean();
    const login = new Map(users.map((u) => [String(u._id), u.lastLoginAt ?? null]));
    const labels = await rbacRolesService.labels();
    return staff.map((s) => toStaff(s as unknown as StaffDoc, labels, login.get(String(s.userId))));
  },

  /** PATCH /admin/users/:id/role */
  async changeRole(userId: string, roleId: string, actor: { id: string; ip: string }) {
    await rbacRolesService.assertExists(roleId);
    const staff = await findStaff(userId);

    const demoting = staff.roleId === SUPER_ADMIN_ROLE_ID && roleId !== SUPER_ADMIN_ROLE_ID && staff.status === 'active';
    if (demoting && (await activeSuperAdminCount()) <= 1) throw LAST_SUPER_ADMIN();

    const before = staff.roleId;
    staff.roleId = roleId;
    await staff.save();
    rbacPermissions.invalidate(userId); // new role applies on the next request
    await audit(actor, 'user.role_changed', userId, { roleId: before }, { roleId });
    return toStaff(staff, await rbacRolesService.labels(), await lastLoginOf(userId));
  },

  /** PATCH /admin/staff/:id  { status: 'active' | 'deactivated' } */
  async setStatus(userId: string, status: StaffStatusValue, actor: { id: string; ip: string }) {
    if (status !== 'active' && status !== 'deactivated') throw new HttpError(422, 'Invalid status.', 'VALIDATION_ERROR');
    const staff = await findStaff(userId);
    const before = staff.status;

    if (status === 'deactivated') {
      if (userId === actor.id) throw new HttpError(409, 'You can’t deactivate your own account.', 'CANNOT_DEACTIVATE_SELF');
      if (staff.roleId === SUPER_ADMIN_ROLE_ID && staff.status === 'active' && (await activeSuperAdminCount()) <= 1) throw LAST_SUPER_ADMIN();
      staff.status = 'deactivated';
      await staff.save();
      await UserModel.updateOne({ _id: userId }, { $set: { status: 'blocked' } }); // login is checked against users
      await authService.revokeUserSessions(userId); // cut off access right away
    } else {
      if (staff.status === 'invited') throw new HttpError(409, 'This person hasn’t accepted their invite yet.', 'INVITE_PENDING');
      staff.status = 'active';
      await staff.save();
      await UserModel.updateOne({ _id: userId }, { $set: { status: 'active' } });
    }

    rbacPermissions.invalidate(userId);
    await audit(actor, status === 'deactivated' ? 'user.deactivated' : 'user.reactivated', userId, { status: before }, { status });
    return toStaff(staff, await rbacRolesService.labels(), await lastLoginOf(userId));
  },
};
