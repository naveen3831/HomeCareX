/**
 * RBAC contract: `resource:action` permissions and the 6 system roles.
 * The admin UI's permission grid is built from PERMISSION_CATALOG (GET /admin/permissions).
 */

export const SUPER_ADMIN_ROLE_ID = 'role_super_admin';

/** resource -> actions. Includes every key a backend route requires (payments:read, tickets:manage, ...). */
export const PERMISSION_CATALOG: Record<string, readonly string[]> = {
  leads: ['view', 'update'],
  bookings: ['view', 'read', 'update', 'export'],
  customers: ['view', 'update', 'delete'],
  partners: ['view', 'update'],
  kyc: ['approve'],
  tickets: ['view', 'update', 'manage'],
  catalog: ['view', 'manage'],
  pricing: ['view', 'manage'],
  coupons: ['view', 'create', 'update', 'delete'],
  marketing: ['view', 'manage'],
  payments: ['view', 'read', 'refund', 'export'],
  refunds: ['view', 'approve'],
  payouts: ['view', 'approve', 'export'],
  reviews: ['view', 'delete', 'moderate'],
  reports: ['view', 'export'],
  roles: ['view', 'create', 'update', 'delete'],
  staff: ['view', 'create', 'update'],
  audit: ['view', 'export'],
  settings: ['view', 'update', 'manage'],
};

export interface PermissionInfo {
  key: string;
  resource: string;
  action: string;
}

export const ALL_PERMISSIONS: PermissionInfo[] = Object.entries(PERMISSION_CATALOG).flatMap(([resource, actions]) =>
  actions.map((action) => ({ key: `${resource}:${action}`, resource, action })),
);
export const ALL_PERMISSION_KEYS: ReadonlySet<string> = new Set(ALL_PERMISSIONS.map((p) => p.key));

const keys = (resource: string, ...actions: string[]) => actions.map((a) => `${resource}:${a}`);

export interface SystemRoleDef {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    id: SUPER_ADMIN_ROLE_ID,
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to everything, including roles and staff.',
    permissions: ['*'],
  },
  {
    id: 'role_admin',
    key: 'admin',
    name: 'Admin',
    description: 'Runs day-to-day operations. Can’t manage roles or staff.',
    permissions: ALL_PERMISSIONS.map((p) => p.key).filter((k) => !k.startsWith('roles:') && !k.startsWith('staff:')),
  },
  {
    id: 'role_support_agent',
    key: 'support_agent',
    name: 'Support Agent',
    description: 'Handles tickets and looks up bookings and customers.',
    permissions: [
      ...keys('bookings', 'view', 'read'),
      ...keys('customers', 'view'),
      ...keys('tickets', 'view', 'update', 'manage'),
      ...keys('leads', 'view', 'update'),
    ],
  },
  {
    id: 'role_finance',
    key: 'finance',
    name: 'Finance',
    description: 'Payments, refunds and payouts.',
    permissions: [
      ...keys('payments', 'view', 'read', 'refund', 'export'),
      ...keys('refunds', 'view', 'approve'),
      ...keys('payouts', 'view', 'approve', 'export'),
      ...keys('reports', 'view', 'export'),
    ],
  },
  {
    id: 'role_content_editor',
    key: 'content_editor',
    name: 'Content Editor',
    description: 'Catalog, pricing and marketing only.',
    permissions: [
      ...keys('catalog', 'view', 'manage'),
      ...keys('pricing', 'view', 'manage'),
      ...keys('coupons', 'view', 'create', 'update'),
      ...keys('marketing', 'view', 'manage'),
    ],
  },
  {
    id: 'role_ops_supervisor',
    key: 'ops_supervisor',
    name: 'Ops Supervisor',
    description: 'Bookings, partners and KYC approvals.',
    permissions: [
      ...keys('bookings', 'view', 'read', 'update', 'export'),
      ...keys('partners', 'view', 'update'),
      ...keys('customers', 'view'),
      ...keys('reviews', 'view', 'moderate'),
      ...keys('kyc', 'approve'),
    ],
  },
];

export const SYSTEM_ROLE_IDS: ReadonlySet<string> = new Set(SYSTEM_ROLES.map((r) => r.id));

export const ROLE_AUDIT = { entity: 'role', created: 'role.created', updated: 'role.updated', deleted: 'role.deleted' } as const;

export interface RoleInputClean {
  name: string;
  description: string;
  permissions: string[];
}

/** Pure validation for POST/PATCH /admin/roles bodies. Returns the cleaned value or the list of problems. */
export function validateRoleInput(
  body: unknown,
  { partial }: { partial: boolean },
): { ok: true; value: Partial<RoleInputClean> } | { ok: false; problems: { field: string; message: string }[] } {
  const problems: { field: string; message: string }[] = [];
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: Partial<RoleInputClean> = {};

  if (!partial || b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 2 || name.length > 40) problems.push({ field: 'name', message: 'Role name must be 2 to 40 characters' });
    else value.name = name;
  }
  if (b.description !== undefined) {
    const d = typeof b.description === 'string' ? b.description.trim() : null;
    if (d === null || d.length > 200) problems.push({ field: 'description', message: 'Description must be text up to 200 characters' });
    else value.description = d;
  } else if (!partial) value.description = '';

  if (!partial || b.permissions !== undefined) {
    const list = Array.isArray(b.permissions) ? b.permissions : null;
    if (!list || list.length === 0) problems.push({ field: 'permissions', message: 'Choose at least one permission' });
    else {
      const unknown = list.filter((p) => typeof p !== 'string' || !ALL_PERMISSION_KEYS.has(p));
      if (unknown.length) problems.push({ field: 'permissions', message: `Unknown permission: ${unknown.map(String).join(', ')}` });
      else value.permissions = [...new Set(list as string[])];
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, value };
}

/**
 * Method -> action for a resource, falling back to what the resource actually offers:
 * GET=view, POST=create, PATCH/PUT=update, DELETE=delete; resources with only `manage` (catalog, pricing...) use it for writes.
 */
export function actionFor(resource: string, method: string): string {
  const offered = PERMISSION_CATALOG[resource] ?? [];
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'view';
  const wanted = m === 'POST' ? 'create' : m === 'DELETE' ? 'delete' : 'update';
  if (offered.includes(wanted)) return wanted;
  if (offered.includes('manage')) return 'manage';
  return offered.includes('update') ? 'update' : wanted;
}
