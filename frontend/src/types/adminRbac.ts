/** RBAC contract for /admin/permissions, /admin/roles and /admin/staff. */

export interface Permission {
  /** `resource:action`, e.g. `bookings:update`. */
  key: string;
  resource: string;
  action: string;
  label?: string;
}

export interface Role {
  id: string;
  /** Stable key for system roles (`super_admin`, ...). Absent on custom roles. */
  key?: string;
  name: string;
  description?: string;
  permissions: string[];
  /** System roles can't be renamed, edited or deleted. */
  isSystem: boolean;
  memberCount: number;
  updatedAt?: string;
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export type StaffStatus = 'active' | 'invited' | 'deactivated';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  roleKey?: string;
  status: StaffStatus;
  lastLoginAt?: string | null;
}

export interface InviteStaffInput {
  name: string;
  email: string;
  roleId: string;
}

export const SUPER_ADMIN_KEY = 'super_admin';
