import http, { type ApiResponse } from '@/lib/http';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/services/authApi';
import { rbacMock } from '@/services/adminRbacMock';
import type {
  InviteStaffInput,
  Permission,
  Role,
  RoleInput,
  StaffMember,
} from '@/types/adminRbac';

/** Query keys. Everything RBAC lives under one root so one call invalidates it all. */
export const rbacKeys = {
  all: ['admin', 'rbac'] as const,
  permissions: ['admin', 'rbac', 'permissions'] as const,
  roles: ['admin', 'rbac', 'roles'] as const,
  staff: ['admin', 'rbac', 'staff'] as const,
};

/** The backend rbac module is live, so real data is the default. Mocks only when VITE_MOCK_RBAC=true. */
export const USE_RBAC_MOCK = import.meta.env.VITE_MOCK_RBAC === 'true';


const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data;

/** The API may send plain keys (`bookings:view`) or objects; the UI always gets objects. */
export function normalizePermission(p: string | Partial<Permission>): Permission {
  const key = typeof p === 'string' ? p : String(p.key ?? '');
  // The last segment is the action, everything before it is the resource ("partner:jobs:read" -> partner:jobs / read).
  const parts = key.split(':');
  const action = parts.length > 1 ? (parts.pop() as string) : 'access';
  const resource = parts.join(':');
  return {
    key,
    resource: typeof p === 'string' ? resource : (p.resource ?? resource),
    action: typeof p === 'string' ? action : (p.action ?? action),
    ...(typeof p !== 'string' && p.label ? { label: p.label } : {}),
  };
}

/** GET /admin/permissions */
export async function fetchPermissions(): Promise<Permission[]> {
  if (USE_RBAC_MOCK) return rbacMock.permissions();
  const list = unwrap(await http.get<ApiResponse<Array<string | Permission>>>('/admin/permissions'));
  return list.map(normalizePermission).filter((p) => p.key && p.key !== '*');
}

/** GET /admin/roles */
export async function fetchRoles(): Promise<Role[]> {
  if (USE_RBAC_MOCK) return rbacMock.roles();
  return unwrap(await http.get<ApiResponse<Role[]>>('/admin/roles'));
}

/** POST /admin/roles */
export async function createRole(input: RoleInput): Promise<Role> {
  if (USE_RBAC_MOCK) return rbacMock.createRole(input);
  return unwrap(await http.post<ApiResponse<Role>>('/admin/roles', input));
}

/** PATCH /admin/roles/:id */
export async function updateRole(id: string, input: Partial<RoleInput>): Promise<Role> {
  if (USE_RBAC_MOCK) return rbacMock.updateRole(id, input);
  return unwrap(await http.patch<ApiResponse<Role>>(`/admin/roles/${id}`, input));
}

/** DELETE /admin/roles/:id */
export async function deleteRole(id: string): Promise<void> {
  if (USE_RBAC_MOCK) return rbacMock.deleteRole(id);
  await http.delete(`/admin/roles/${id}`);
}

/** GET /admin/staff */
export async function fetchStaff(): Promise<StaffMember[]> {
  if (USE_RBAC_MOCK) return rbacMock.staff();
  return unwrap(await http.get<ApiResponse<StaffMember[]>>('/admin/staff'));
}

/**
 * POST /admin/staff: sends an invite.
 * The invite ALWAYS goes to the real backend (it creates the account and emails the accept-invite link).
 * In mock mode only (VITE_MOCK_RBAC=true) the Staff table row comes from the local mock list.
 */
export async function inviteStaff(input: InviteStaffInput): Promise<StaffMember> {
  const sent = unwrap(await http.post<ApiResponse<StaffMember>>('/admin/staff', input));
  if (!USE_RBAC_MOCK) return sent;
  try {
    const row = await rbacMock.invite(input, sent.id); // same id as the real account, so their role sticks
    return { ...row, inviteLink: undefined, emailSent: sent.emailSent };
  } catch {
    return sent; // already in the mock list (re-invite): the email was still sent
  }
}

/** PATCH /admin/users/:id/role */
export async function changeStaffRole(userId: string, roleId: string): Promise<void> {
  if (USE_RBAC_MOCK) return rbacMock.changeRole(userId, roleId);
  await http.patch(`/admin/users/${userId}/role`, { roleId });
}

/** PATCH /admin/staff/:id  { status: 'active' | 'deactivated' } */
export async function setStaffStatus(userId: string, status: 'active' | 'deactivated'): Promise<void> {
  if (USE_RBAC_MOCK) return rbacMock.setStatus(userId, status);
  await http.patch(`/admin/staff/${userId}`, { status });
}

export async function logoutAllSessions(userId: string): Promise<void> {
  if (USE_RBAC_MOCK) return rbacMock.logoutAll(userId);
  // Already exists in the auth module (admin only): bumps tokenVersion and clears the user's sessions.
  await http.post(`/auth/revoke-user-sessions/${encodeURIComponent(userId)}`);
}

/**
 * Re-reads the signed-in admin so a role/permission change shows up in the
 * sidebar and PermissionGates immediately, without a page reload.
 */
export async function refreshCurrentUser(): Promise<void> {
  if (USE_RBAC_MOCK) return rbacMock.syncCurrentUser();
  try {
    const me = await authApi.me();
    useAuthStore.setState({ user: me as unknown as Record<string, unknown> });
  } catch {
    /* keep the old permissions; the next token refresh will pick them up */
  }
}