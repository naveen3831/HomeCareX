import { beforeEach, describe, expect, it } from 'vitest';
import { rbacMock, resetRbacMock, getMockAudit } from '@/services/adminRbacMock';
import { useAuthStore } from '@/store/useAuthStore';

const codeOf = (e: unknown) => (e as { response?: { data?: { code?: string } } }).response?.data?.code;

beforeEach(() => {
  localStorage.clear();
  resetRbacMock();
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'staff_1', name: 'Ananya Rao', role: 'admin' } });
});

describe('RBAC mock API', () => {
  it('lists permissions, roles with member counts, and staff', async () => {
    expect((await rbacMock.permissions()).length).toBeGreaterThan(30);
    const roles = await rbacMock.roles();
    expect(roles.find((r) => r.key === 'super_admin')).toMatchObject({ isSystem: true, memberCount: 2 });
    expect((await rbacMock.staff()).length).toBeGreaterThanOrEqual(8);
  });

  it('protects system roles from edit and delete', async () => {
    await expect(rbacMock.updateRole('role_admin', { name: 'X' })).rejects.toSatisfy((e) => codeOf(e) === 'SYSTEM_ROLE_PROTECTED');
    await expect(rbacMock.deleteRole('role_super_admin')).rejects.toSatisfy((e) => codeOf(e) === 'SYSTEM_ROLE_PROTECTED');
  });

  it('creates, edits and deletes a custom role; blocks duplicates and in-use deletes', async () => {
    const role = await rbacMock.createRole({ name: 'QA Lead', permissions: ['bookings:view'] });
    await expect(rbacMock.createRole({ name: 'qa lead', permissions: [] })).rejects.toBeTruthy();
    await rbacMock.updateRole(role.id, { permissions: ['bookings:view', 'bookings:update'] });
    expect((await rbacMock.roles()).find((r) => r.id === role.id)?.permissions).toHaveLength(2);
    await rbacMock.deleteRole(role.id);

    await expect(rbacMock.deleteRole('role_content_editor')).rejects.toSatisfy((e) => codeOf(e) === 'ROLE_IN_USE'); // has an invited member
    await expect(rbacMock.deleteRole('role_ops_supervisor')).resolves.toBeUndefined(); // only a deactivated member, so it is free to delete
  });

  it('never removes the last active super_admin', async () => {
    await rbacMock.staff();
    await rbacMock.changeRole('staff_2', 'role_admin'); // 2 -> 1 super admins: allowed
    await expect(rbacMock.changeRole('staff_1', 'role_admin')).rejects.toSatisfy((e) => codeOf(e) === 'LAST_SUPER_ADMIN');
    await expect(rbacMock.setStatus('staff_1', 'deactivated')).rejects.toSatisfy((e) => codeOf(e) === 'LAST_SUPER_ADMIN');
  });

  it('records audit entries for role and staff changes', async () => {
    const role = await rbacMock.createRole({ name: 'Auditor', permissions: ['audit:view'] });
    await rbacMock.changeRole('staff_4', role.id);
    await rbacMock.setStatus('staff_5', 'deactivated');
    const actions = getMockAudit().map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['role.created', 'user.role_changed', 'user.deactivated']));
  });

  it('a custom role restricts the signed-in admin (sidebar permissions)', async () => {
    const role = await rbacMock.createRole({ name: 'Viewer', permissions: ['bookings:view'] });
    await rbacMock.staff();
    await rbacMock.changeRole('staff_1', role.id); // staff_2 is still a super admin
    rbacMock.syncCurrentUser();
    const user = useAuthStore.getState().user as { role: string; permissions: string[] };
    expect(user.role).toBe('staff');
    expect(user.permissions).toEqual(['bookings:view']);
  });
});
