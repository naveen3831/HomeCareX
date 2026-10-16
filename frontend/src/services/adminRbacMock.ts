/**
 * In-memory mock of the RBAC API (no backend module exists yet).
 * Enabled by default; set VITE_MOCK_RBAC=false once backend/src/modules/rbac is merged.
 *
 * It enforces the same rules the real API must:
 *  - system roles can't be edited or deleted            -> 403 SYSTEM_ROLE_PROTECTED
 *  - a role with members can't be deleted               -> 409 ROLE_IN_USE
 *  - the last active super_admin can't be demoted/off   -> 409 LAST_SUPER_ADMIN
 *  - every change appends an audit entry (see getMockAudit)
 * State is kept in localStorage so a refresh doesn't wipe your demo data.
 * Reset everything from the console:  localStorage.removeItem('hcx.mock.rbac')
 */
import { useAuthStore } from '@/store/useAuthStore';
import type {
  InviteStaffInput,
  Permission,
  Role,
  RoleInput,
  StaffMember,
  StaffStatus,
} from '@/types/adminRbac';
import { SUPER_ADMIN_KEY } from '@/types/adminRbac';

const STORAGE_KEY = 'hcx.mock.rbac';
const LATENCY_MS = 250;

// ---------- permission catalog ----------
const CATALOG: Record<string, string[]> = {
  leads: ['view', 'update'],
  bookings: ['view', 'update', 'export'],
  customers: ['view', 'update', 'delete'],
  partners: ['view', 'update'],
  kyc: ['approve'],
  tickets: ['view', 'update'],
  catalog: ['view', 'manage'],
  pricing: ['view', 'manage'],
  coupons: ['view', 'create', 'update', 'delete'],
  marketing: ['view', 'manage'],
  payments: ['view', 'refund', 'export'],
  refunds: ['view', 'approve'],
  payouts: ['view', 'approve', 'export'],
  reviews: ['view', 'delete'],
  reports: ['view', 'export'],
  roles: ['view', 'create', 'update', 'delete'],
  staff: ['view', 'create', 'update'],
  audit: ['view', 'export'],
  settings: ['view', 'update'],
};

const PERMISSIONS: Permission[] = Object.entries(CATALOG).flatMap(([resource, actions]) =>
  actions.map((action) => ({ key: `${resource}:${action}`, resource, action })),
);
const ALL_KEYS = new Set(PERMISSIONS.map((p) => p.key));
const viewOf = (resources: string[]) => resources.map((r) => `${r}:view`);

// ---------- seed ----------
interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}
interface MockDb {
  roles: Array<Omit<Role, 'memberCount'>>;
  staff: StaffMember[];
  audit: AuditEntry[];
  seq: number;
}

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();

function seed(): MockDb {
  const roles: MockDb['roles'] = [
    { id: 'role_super_admin', key: 'super_admin', name: 'Super Admin', description: 'Full access to everything, including roles and staff.', permissions: ['*'], isSystem: true, updatedAt: ago(90) },
    { id: 'role_admin', key: 'admin', name: 'Admin', description: 'Runs day-to-day operations. Can’t manage roles.', permissions: PERMISSIONS.map((p) => p.key).filter((k) => !k.startsWith('roles:') && !k.startsWith('staff:')), isSystem: true, updatedAt: ago(90) },
    { id: 'role_support_agent', key: 'support_agent', name: 'Support Agent', description: 'Handles tickets and looks up bookings and customers.', permissions: [...viewOf(['bookings', 'customers', 'tickets', 'leads']), 'tickets:update', 'leads:update'], isSystem: true, updatedAt: ago(60) },
    { id: 'role_finance', key: 'finance', name: 'Finance', description: 'Payments, refunds and payouts.', permissions: [...viewOf(['payments', 'refunds', 'payouts', 'reports']), 'payments:refund', 'payments:export', 'refunds:approve', 'payouts:approve', 'payouts:export', 'reports:export'], isSystem: true, updatedAt: ago(60) },
    { id: 'role_content_editor', name: 'Content Editor', description: 'Catalog, pricing and marketing only.', permissions: [...viewOf(['catalog', 'pricing', 'coupons', 'marketing']), 'catalog:manage', 'coupons:create', 'coupons:update', 'marketing:manage'], isSystem: false, updatedAt: ago(12) },
    { id: 'role_ops_supervisor', name: 'Ops Supervisor', description: 'Bookings, partners and KYC approvals.', permissions: [...viewOf(['bookings', 'partners', 'customers', 'reviews']), 'bookings:update', 'bookings:export', 'partners:update', 'kyc:approve'], isSystem: false, updatedAt: ago(5) },
  ];
  const m = (n: number, name: string, email: string, roleId: string, status: StaffStatus, last: string | null): StaffMember => {
    const r = roles.find((x) => x.id === roleId)!;
    return { id: `staff_${n}`, name, email, roleId, roleName: r.name, roleKey: r.key, status, lastLoginAt: last };
  };
  const staff: StaffMember[] = [
    m(1, 'Ananya Rao', 'ananya.rao@homecarex.in', 'role_super_admin', 'active', ago(0, 2)),
    m(2, 'Vikram Reddy', 'vikram.reddy@homecarex.in', 'role_super_admin', 'active', ago(1)),
    m(3, 'Priya Sharma', 'priya.sharma@homecarex.in', 'role_admin', 'active', ago(0, 6)),
    m(4, 'Rahul Verma', 'rahul.verma@homecarex.in', 'role_support_agent', 'active', ago(0, 1)),
    m(5, 'Sneha Iyer', 'sneha.iyer@homecarex.in', 'role_support_agent', 'active', ago(3)),
    m(6, 'Karthik Nair', 'karthik.nair@homecarex.in', 'role_finance', 'active', ago(2)),
    m(7, 'Meera Joshi', 'meera.joshi@homecarex.in', 'role_content_editor', 'invited', null),
    m(8, 'Arjun Mehta', 'arjun.mehta@homecarex.in', 'role_ops_supervisor', 'deactivated', ago(40)),
  ];
  return { roles, staff, audit: [], seq: 100 };
}

// ---------- persistence ----------
let db: MockDb | null = null;
function load(): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (db = JSON.parse(raw) as MockDb);
  } catch { /* fall through to a fresh seed */ }
  return (db = seed());
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* private mode: state lives in memory only */ }
}

// ---------- helpers ----------
const wait = <T,>(value: T): Promise<T> => new Promise((res) => setTimeout(() => res(structuredClone(value)), LATENCY_MS));

/** Shaped like an axios error so errorMessage()/errorCode() in rbacUtils read it. */
function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { response: { status, data: { success: false, code, message } } });
}
const fail = (status: number, code: string, message: string) => new Promise<never>((_, rej) => setTimeout(() => rej(apiError(status, code, message)), LATENCY_MS));

const self = () => {
  const u = useAuthStore.getState().user as Record<string, unknown> | null;
  const id = (u?.id ?? u?._id) as string | undefined;
  const name = String(u?.name ?? u?.fullName ?? 'HomeCareX Admin');
  return { id, name, email: String(u?.email ?? 'admin@homecarex.in') };
};

/** The signed-in admin becomes staff #1 so they can see and change their own role. */
function ensureSelf(d: MockDb) {
  const me = self();
  if (!me.id || d.staff.some((s) => s.id === me.id)) return;
  const sa = d.roles.find((r) => r.key === SUPER_ADMIN_KEY)!;
  d.staff.unshift({ id: me.id, name: me.name, email: me.email, roleId: sa.id, roleName: sa.name, roleKey: sa.key, status: 'active', lastLoginAt: new Date().toISOString() });
  save();
}

function audit(action: string, target: string, detail?: string) {
  const d = load();
  d.audit.unshift({ id: `aud_${++d.seq}`, at: new Date().toISOString(), actor: self().name, action, target, detail });
  d.audit = d.audit.slice(0, 200);
}

const withCount = (d: MockDb, r: MockDb['roles'][number]): Role => ({
  ...r,
  memberCount: d.staff.filter((s) => s.roleId === r.id && s.status !== 'deactivated').length,
});

const activeSuperAdmins = (d: MockDb) => d.staff.filter((s) => s.roleKey === SUPER_ADMIN_KEY && s.status === 'active');
const LAST_SA = () => fail(409, 'LAST_SUPER_ADMIN', 'This is the last active Super Admin. Promote another person first, then try again.');

function validateInput(d: MockDb, input: Partial<RoleInput>, ignoreId?: string): string | null {
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 2) return 'Role name must be at least 2 characters.';
    if (d.roles.some((r) => r.id !== ignoreId && r.name.trim().toLowerCase() === n.toLowerCase())) return 'A role with this name already exists.';
  }
  const bad = (input.permissions ?? []).find((k) => !ALL_KEYS.has(k));
  return bad ? `Unknown permission “${bad}”.` : null;
}

// ---------- API (mirrors adminRbacApi) ----------
export const rbacMock = {
  permissions: () => wait(PERMISSIONS),

  roles: () => {
    const d = load();
    return wait(d.roles.map((r) => withCount(d, r)));
  },

  createRole(input: RoleInput) {
    const d = load();
    const err = validateInput(d, input);
    if (err) return fail(422, 'VALIDATION_ERROR', err);
    const role: MockDb['roles'][number] = { id: `role_${++d.seq}`, name: input.name.trim(), description: input.description, permissions: [...new Set(input.permissions)], isSystem: false, updatedAt: new Date().toISOString() };
    d.roles.push(role);
    audit('role.created', role.name, `${role.permissions.length} permissions`);
    save();
    return wait(withCount(d, role));
  },

  updateRole(id: string, input: Partial<RoleInput>) {
    const d = load();
    const role = d.roles.find((r) => r.id === id);
    if (!role) return fail(404, 'NOT_FOUND', 'This role doesn’t exist or was deleted.');
    if (role.isSystem) return fail(403, 'SYSTEM_ROLE_PROTECTED', 'System roles can’t be edited.');
    const err = validateInput(d, input, id);
    if (err) return fail(422, 'VALIDATION_ERROR', err);
    const before = role.permissions.length;
    if (input.name !== undefined) role.name = input.name.trim();
    if (input.description !== undefined) role.description = input.description;
    if (input.permissions) role.permissions = [...new Set(input.permissions)];
    role.updatedAt = new Date().toISOString();
    // keep denormalised names on staff rows in sync
    d.staff.filter((s) => s.roleId === id).forEach((s) => { s.roleName = role.name; });
    audit('role.updated', role.name, `permissions ${before} → ${role.permissions.length}`);
    save();
    return wait(withCount(d, role));
  },

  deleteRole(id: string) {
    const d = load();
    const role = d.roles.find((r) => r.id === id);
    if (!role) return fail(404, 'NOT_FOUND', 'This role doesn’t exist or was deleted.');
    if (role.isSystem) return fail(403, 'SYSTEM_ROLE_PROTECTED', 'System roles can’t be deleted.');
    const members = d.staff.filter((s) => s.roleId === id && s.status !== 'deactivated').length;
    if (members > 0) return fail(409, 'ROLE_IN_USE', `Move its ${members} member${members === 1 ? '' : 's'} to another role first.`);
    d.roles = d.roles.filter((r) => r.id !== id);
    audit('role.deleted', role.name);
    save();
    return wait(undefined as void);
  },

  staff() {
    const d = load();
    ensureSelf(d);
    return wait(d.staff);
  },

  invite(input: InviteStaffInput) {
    const d = load();
    const role = d.roles.find((r) => r.id === input.roleId);
    if (!role) return fail(422, 'VALIDATION_ERROR', 'Choose a valid role.');
    const email = input.email.trim().toLowerCase();
    if (d.staff.some((s) => s.email.toLowerCase() === email)) return fail(409, 'EMAIL_TAKEN', 'Someone with this email is already on the team.');
    const member: StaffMember = { id: `staff_${++d.seq}`, name: input.name.trim(), email, roleId: role.id, roleName: role.name, roleKey: role.key, status: 'invited', lastLoginAt: null };
    d.staff.push(member);
    audit('staff.invited', member.email, `role: ${role.name}`);
    save();
    return wait(member);
  },

  changeRole(userId: string, roleId: string) {
    const d = load();
    ensureSelf(d);
    const member = d.staff.find((s) => s.id === userId);
    const role = d.roles.find((r) => r.id === roleId);
    if (!member || !role) return fail(404, 'NOT_FOUND', 'Person or role not found.');
    const demoting = member.roleKey === SUPER_ADMIN_KEY && role.key !== SUPER_ADMIN_KEY && member.status === 'active';
    if (demoting && activeSuperAdmins(d).length <= 1) return LAST_SA();
    const from = member.roleName;
    Object.assign(member, { roleId: role.id, roleName: role.name, roleKey: role.key });
    audit('user.role_changed', member.email, `${from} → ${role.name}`);
    save();
    return wait(undefined as void);
  },

  setStatus(userId: string, status: 'active' | 'deactivated') {
    const d = load();
    ensureSelf(d);
    const member = d.staff.find((s) => s.id === userId);
    if (!member) return fail(404, 'NOT_FOUND', 'Person not found.');
    if (status === 'deactivated' && member.roleKey === SUPER_ADMIN_KEY && member.status === 'active' && activeSuperAdmins(d).length <= 1) return LAST_SA();
    member.status = status;
    audit(status === 'active' ? 'user.reactivated' : 'user.deactivated', member.email);
    save();
    return wait(undefined as void);
  },

  logoutAll(userId: string) {
    const d = load();
    const member = d.staff.find((s) => s.id === userId);
    if (!member) return fail(404, 'NOT_FOUND', 'Person not found.');
    audit('user.sessions_revoked', member.email);
    save();
    return wait(undefined as void);
  },

  /** Applies the signed-in admin's (mock) role to the auth store so the sidebar and gates update. */
  syncCurrentUser() {
    const d = load();
    ensureSelf(d);
    const me = self();
    const member = d.staff.find((s) => s.id === me.id);
    const role = member && d.roles.find((r) => r.id === member.roleId);
    if (!member || !role) return;
    const prev = (useAuthStore.getState().user ?? {}) as Record<string, unknown>;
    useAuthStore.setState({
      user: { ...prev, role: role.key ?? 'staff', roleKey: role.key, roleName: role.name, permissions: role.permissions },
    });
  },
};

/** Audit trail written by the mock (until GET /admin/audit-logs shows real RBAC events). */
export const getMockAudit = (): AuditEntry[] => structuredClone(load().audit);
export const resetRbacMock = () => { db = seed(); save(); };
