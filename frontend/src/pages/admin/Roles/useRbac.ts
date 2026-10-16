import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeStaffRole,
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  fetchStaff,
  inviteStaff,
  logoutAllSessions,
  rbacKeys,
  refreshCurrentUser,
  setStaffStatus,
  updateRole,
} from '@/services/adminRbacApi';
import type { InviteStaffInput, RoleInput } from '@/types/adminRbac';

export const usePermissionCatalog = () =>
  useQuery({ queryKey: rbacKeys.permissions, queryFn: fetchPermissions, staleTime: 5 * 60_000 });

export const useRoles = () => useQuery({ queryKey: rbacKeys.roles, queryFn: fetchRoles });

export const useStaff = (enabled = true) => useQuery({ queryKey: rbacKeys.staff, queryFn: fetchStaff, enabled });

/**
 * Permission cache invalidation.
 * After any change that can alter what someone may do, drop every cached RBAC list (roles carry
 * member counts, staff carry role names) and re-read the signed-in admin, so an edit to your own
 * role shows up in the sidebar and in every PermissionGate without a reload.
 */
function useInvalidateRbac() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: rbacKeys.all }), refreshCurrentUser()]);
  };
}

export function useRbacMutations() {
  const invalidate = useInvalidateRbac();
  const onSuccess = () => invalidate();

  return {
    create: useMutation({ mutationFn: (input: RoleInput) => createRole(input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<RoleInput> }) => updateRole(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteRole(id), onSuccess }),
    invite: useMutation({ mutationFn: (input: InviteStaffInput) => inviteStaff(input), onSuccess }),
    changeRole: useMutation({
      mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => changeStaffRole(userId, roleId),
      onSuccess,
    }),
    setStatus: useMutation({
      mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'deactivated' }) =>
        setStaffStatus(userId, status),
      onSuccess,
    }),
    logoutAll: useMutation({ mutationFn: (userId: string) => logoutAllSessions(userId), onSuccess }),
  };
}
