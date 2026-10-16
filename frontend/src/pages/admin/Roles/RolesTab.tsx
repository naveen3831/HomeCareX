import React, { useMemo, useState } from 'react';
import { Layers, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import type { Role } from '@/types/adminRbac';
import { RbacSearch, RbacStats } from './RbacStats';
import { RbacTable } from './RbacTable';
import { RBAC_PERMISSIONS } from './rbacPermissions';
import { errorMessage } from './rbacUtils';
import { useRbacMutations, useRoles } from './useRbac';

interface RolesTabProps {
  notify: (text: string, tone?: 'success' | 'error') => void;
}

export const RolesTab: React.FC<RolesTabProps> = ({ notify }) => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const rolesQuery = useRoles();
  const { remove } = useRbacMutations();

  const [toDelete, setToDelete] = useState<Role | null>(null);
  const [query, setQuery] = useState('');
  const allRoles = rolesQuery.data ?? [];
  const roles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allRoles.filter((r) => `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q)) : allRoles;
  }, [allRoles, query]);
  const stats = {
    total: allRoles.length,
    system: allRoles.filter((r) => r.isSystem).length,
    custom: allRoles.filter((r) => !r.isSystem).length,
    members: allRoles.reduce((n, r) => n + r.memberCount, 0),
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        notify(`Role “${toDelete.name}” deleted.`);
        setToDelete(null);
      },
      onError: (e) => {
        notify(errorMessage(e), 'error');
        setToDelete(null);
      },
    });
  };

  const canDelete = can(RBAC_PERMISSIONS.rolesDelete);

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Role',
      cell: (r) => (
        <div className="rbac-role-name">
          <div className="rbac-role-name__top">
            <strong>{r.name}</strong>
            {r.isSystem && (
              <span className="rbac-system-chip" title="System roles can’t be edited or deleted">
                <Lock size={12} aria-hidden /> System
              </span>
            )}
          </div>
          {r.description && <div className="rbac-muted rbac-role-name__desc">{r.description}</div>}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      hideOnMobile: true,
      cell: (r) => (r.permissions.includes('*') ? 'Full access' : `${r.permissions.length}`),
    },
    { key: 'members', header: 'Members', cell: (r) => r.memberCount },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      cell: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => {
        const locked = r.isSystem;
        const inUse = r.memberCount > 0;
        return (
          <div className="rbac-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit ${r.name}`}
              title="Edit role"
              onClick={() => navigate(`/admin/roles/${r.id}`)}
            >
              <Pencil size={16} />
            </button>
            {canDelete && (
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label={`Delete ${r.name}`}
                disabled={locked || inUse}
                title={
                  locked
                    ? 'System roles can’t be deleted'
                    : inUse
                      ? `Move its ${r.memberCount} member${r.memberCount === 1 ? '' : 's'} to another role first`
                      : 'Delete role'
                }
                onClick={() => setToDelete(r)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section aria-label="Roles">
      <RbacStats
        label="Role summary"
        items={[
          { label: 'Total roles', value: stats.total, icon: <ShieldCheck size={18} /> },
          { label: 'System roles', value: stats.system, icon: <Lock size={18} /> },
          { label: 'Custom roles', value: stats.custom, icon: <Layers size={18} /> },
          { label: 'People assigned', value: stats.members, icon: <Users size={18} /> },
        ]}
      />

      <div className="rbac-toolbar">
        <RbacSearch value={query} onChange={setQuery} placeholder="Search roles" label="Search roles" />
        <PermissionGate permission={RBAC_PERMISSIONS.rolesCreate}>
          <button type="button" className="hcx-btn hcx-btn--primary rbac-cta" onClick={() => navigate('/admin/roles/new')}>
            <Plus size={16} aria-hidden /> Create role
          </button>
        </PermissionGate>
      </div>

    

      <RbacTable variant="roles">
        <DataTable
          label="Roles"
          columns={columns}
          data={roles}
          rowKey={(r) => r.id}
          loading={rolesQuery.isLoading}
          error={rolesQuery.isError ? errorMessage(rolesQuery.error, 'Couldn’t load roles.') : null}
          onRetry={() => void rolesQuery.refetch()}
          emptyTitle={query ? 'No roles match your search' : 'No roles yet'}
          emptyMessage={query ? 'Try a different name.' : 'Create a role to start giving staff limited access.'}
          hidePagination
        />
      </RbacTable>

      <ConfirmDialog
        open={toDelete !== null}
        tone="danger"
        title="Delete role?"
        message={
          <>
            <strong>{toDelete?.name}</strong> will be removed permanently. This is recorded in the audit log.
          </>
        }
        confirmLabel="Delete role"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
};

export default RolesTab;
