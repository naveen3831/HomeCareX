import { randomBytes } from 'crypto';
import { RoleModel } from '../../models/Role';
import { StaffModel } from '../../models/Staff';
import { auditService } from '../audit/audit.service';
import { HttpError } from '../auth/auth.types';
import { ALL_PERMISSIONS, ROLE_AUDIT, SYSTEM_ROLE_IDS, validateRoleInput } from './rbac.constants';
import { ensureSystemRoles, rbacPermissions } from './rbac.permissions';

interface RoleDoc {
  _id: unknown;
  key?: string | null;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem?: boolean | null;
  updatedAt?: Date;
}
type Actor = { id: string; ip: string };

const toRole = (r: RoleDoc, memberCount: number) => ({
  id: String(r._id),
  ...(r.key ? { key: r.key } : {}),
  name: r.name,
  description: r.description ?? '',
  permissions: r.permissions,
  isSystem: Boolean(r.isSystem),
  memberCount,
  updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
});

async function memberCounts(): Promise<Map<string, number>> {
  const staff = await StaffModel.find().select('roleId').lean();
  const counts = new Map<string, number>();
  for (const s of staff) counts.set(s.roleId, (counts.get(s.roleId) ?? 0) + 1);
  return counts;
}

async function audit(actor: Actor, action: string, roleId: string, before: unknown, after: unknown) {
  try {
    await auditService.recordAudit({ actor: actor.id, action, entity: ROLE_AUDIT.entity, entityId: roleId, before, after, ip: actor.ip, result: 'Success' });
  } catch (err) {
    console.error(`[rbac] audit write failed for ${action} on ${roleId}`, err); // the change already happened
  }
}

const isDuplicateName = (err: unknown) => (err as { code?: number })?.code === 11000;

export const rbacRolesService = {
  /** GET /admin/permissions */
  permissions: () => ALL_PERMISSIONS,

  /** GET /admin/roles */
  async list() {
    await ensureSystemRoles();
    const [roles, counts] = await Promise.all([RoleModel.find().sort({ isSystem: -1, createdAt: 1 }).lean(), memberCounts()]);
    return roles.map((r) => toRole(r as RoleDoc, counts.get(String(r._id)) ?? 0));
  },

  /** id -> { name, key } for showing role names on staff rows. */
  async labels(): Promise<Map<string, { name: string; key?: string }>> {
    await ensureSystemRoles();
    const roles = await RoleModel.find().select('name key').lean();
    return new Map(roles.map((r) => [String(r._id), { name: r.name, key: r.key ?? undefined }]));
  },

  /** 422 unless the id is a real role. Used before inviting staff or changing a role. */
  async assertExists(roleId: unknown): Promise<void> {
    await ensureSystemRoles();
    if (typeof roleId !== 'string' || !roleId || !(await RoleModel.findById(roleId).select('_id').lean())) {
      throw new HttpError(422, 'Choose a valid role.', 'VALIDATION_ERROR');
    }
  },

  /** POST /admin/roles */
  async create(body: unknown, actor: Actor) {
    const checked = validateRoleInput(body, { partial: false });
    if (!checked.ok) throw validation(checked.problems);
    const v = checked.value as { name: string; description: string; permissions: string[] };
    await ensureSystemRoles();
    const id = `role_${randomBytes(6).toString('hex')}`;
    try {
      const created = await RoleModel.create({ _id: id, name: v.name, description: v.description, permissions: v.permissions, isSystem: false });
      await audit(actor, ROLE_AUDIT.created, id, null, { name: v.name, permissions: v.permissions });
      return toRole(created.toObject() as RoleDoc, 0);
    } catch (err) {
      if (isDuplicateName(err)) throw new HttpError(409, 'A role with this name already exists.', 'ROLE_NAME_TAKEN');
      throw err;
    }
  },

  /** PATCH /admin/roles/:id : system roles are read-only. */
  async update(id: string, body: unknown, actor: Actor) {
    await ensureSystemRoles();
    const role = await RoleModel.findById(id).lean();
    if (!role) throw new HttpError(404, 'Role not found.', 'NOT_FOUND');
    if (role.isSystem || SYSTEM_ROLE_IDS.has(id)) throw new HttpError(403, 'System roles can’t be edited.', 'SYSTEM_ROLE_PROTECTED');

    const checked = validateRoleInput(body, { partial: true });
    if (!checked.ok) throw validation(checked.problems);
    if (Object.keys(checked.value).length === 0) throw new HttpError(422, 'Nothing to update.', 'VALIDATION_ERROR');

    try {
      await RoleModel.updateOne({ _id: id }, { $set: checked.value });
    } catch (err) {
      if (isDuplicateName(err)) throw new HttpError(409, 'A role with this name already exists.', 'ROLE_NAME_TAKEN');
      throw err;
    }
    rbacPermissions.invalidate(); // members' access changes right away, not after the cache expires
    const after = (await RoleModel.findById(id).lean()) as RoleDoc;
    await audit(actor, ROLE_AUDIT.updated, id, { name: role.name, description: role.description, permissions: role.permissions }, { name: after.name, description: after.description, permissions: after.permissions });
    return toRole(after, (await memberCounts()).get(id) ?? 0);
  },

  /** DELETE /admin/roles/:id : not for system roles, not while anybody still has the role. */
  async remove(id: string, actor: Actor) {
    await ensureSystemRoles();
    const role = await RoleModel.findById(id).lean();
    if (!role) throw new HttpError(404, 'Role not found.', 'NOT_FOUND');
    if (role.isSystem || SYSTEM_ROLE_IDS.has(id)) throw new HttpError(403, 'System roles can’t be deleted.', 'SYSTEM_ROLE_PROTECTED');
    const members = (await memberCounts()).get(id) ?? 0;
    if (members > 0) throw new HttpError(409, `${members} staff member(s) still have this role. Move them to another role first.`, 'ROLE_IN_USE');

    await RoleModel.deleteOne({ _id: id });
    rbacPermissions.invalidate();
    await audit(actor, ROLE_AUDIT.deleted, id, { name: role.name, permissions: role.permissions }, null);
  },
};

function validation(problems: { field: string; message: string }[]) {
  const err = new HttpError(422, problems[0].message, 'VALIDATION_ERROR');
  err.details = problems;
  return err;
}
