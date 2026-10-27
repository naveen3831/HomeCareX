import mongoose from 'mongoose';
import { RoleModel } from '../../models/Role';
import { StaffModel } from '../../models/Staff';
import { SYSTEM_ROLES } from './rbac.constants';

const TTL_MS = 30_000;
const cache = new Map<string, { perms: string[]; expires: number }>();
let seeded: Promise<void> | null = null;

/** Writes the 6 system roles (code is their source of truth). Runs once per process, on first use. */
export function ensureSystemRoles(): Promise<void> {
  seeded ??= RoleModel.bulkWrite(
    SYSTEM_ROLES.map((r) => ({
      updateOne: {
        filter: { _id: r.id },
        update: { $set: { key: r.key, name: r.name, description: r.description, permissions: r.permissions, isSystem: true } },
        upsert: true,
      },
    })),
  )
    .then(() => undefined)
    .catch((err) => {
      seeded = null; // try again next time
      throw err;
    });
  return seeded;
}

export const rbacPermissions = {
  /**
   * What an admin account may do, from its staff role. `null` = no database to ask (unit tests, scripts):
   * callers then keep the static role rule. An admin with no staff record is a legacy admin: full access.
   * A deactivated staff member or a staff member whose role was removed gets nothing.
   */
  async resolveAdminPermissions(userId: string): Promise<string[] | null> {
    if (mongoose.connection.readyState !== 1) return null;
    const hit = cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.perms;

    await ensureSystemRoles();
    const staff = await StaffModel.findOne({ userId }).select('roleId status').lean();
    let perms: string[];
    if (!staff) perms = ['*'];
    else if (staff.status === 'deactivated') perms = [];
    else perms = (await RoleModel.findById(staff.roleId).select('permissions').lean())?.permissions ?? [];

    cache.set(userId, { perms, expires: Date.now() + TTL_MS });
    return perms;
  },

  /** Call after any change to a role, a staff role or a staff status. One user, or everybody when omitted. */
  invalidate(userId?: string): void {
    if (userId) cache.delete(userId);
    else cache.clear();
  },
};

export const can = (perms: string[], required: string): boolean => perms.includes('*') || perms.includes(required);
