/** Permission keys that guard the Roles / Staff screens themselves. */
export const RBAC_PERMISSIONS = {
  rolesView: 'roles:view',
  rolesCreate: 'roles:create',
  rolesUpdate: 'roles:update',
  rolesDelete: 'roles:delete',
  staffView: 'staff:view',
  staffInvite: 'staff:create',
  staffUpdate: 'staff:update',
} as const;

/** Error code the API sends when an action would leave the system without a super admin. */
export const LAST_SUPER_ADMIN_CODE = 'LAST_SUPER_ADMIN';

export const LAST_SUPER_ADMIN_MESSAGE =
  'This is the last active Super Admin. Promote another person first, then try again.';
