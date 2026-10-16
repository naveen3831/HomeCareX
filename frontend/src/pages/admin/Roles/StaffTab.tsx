import React, { useMemo, useState } from 'react';
import { LogOut, MailPlus, UserCheck, UserMinus, UserPlus, UserX, Users } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StatusBadge, type Tone } from '@/components/admin/StatusBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { SUPER_ADMIN_KEY, type StaffMember, type StaffStatus } from '@/types/adminRbac';
import { useNavigate } from 'react-router-dom';
import { RbacSearch, RbacStats, initials } from './RbacStats';
import { RbacTable } from './RbacTable';
import { LAST_SUPER_ADMIN_MESSAGE, RBAC_PERMISSIONS } from './rbacPermissions';
import { errorMessage } from './rbacUtils';
import { useRbacMutations, useRoles, useStaff } from './useRbac';

interface StaffTabProps {
  notify: (text: string, tone?: 'success' | 'error') => void;
}

type Pending =
  | { kind: 'role'; member: StaffMember; roleId: string; roleName: string }
  | { kind: 'status'; member: StaffMember; status: 'active' | 'deactivated' }
  | { kind: 'logout'; member: StaffMember }
  | null;

const STATUS_TONE: Record<StaffStatus, Tone> = { active: 'success', invited: 'warning', deactivated: 'neutral' };

export const StaffTab: React.FC<StaffTabProps> = ({ notify }) => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const selfId = useAuthStore((s) => (s.user?.id ?? s.user?._id) as string | undefined);
  const staffQuery = useStaff();
  const rolesQuery = useRoles();
  const { changeRole, setStatus, logoutAll } = useRbacMutations();

  const [pending, setPending] = useState<Pending>(null);

  const [query, setQuery] = useState('');
  const allStaff = staffQuery.data ?? [];
  const staff = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allStaff.filter((m) => `${m.name} ${m.email} ${m.roleName}`.toLowerCase().includes(q)) : allStaff;
  }, [allStaff, query]);
  const count = (st: StaffStatus) => allStaff.filter((m) => m.status === st).length;
  const roles = rolesQuery.data ?? [];
  const canInvite = can(RBAC_PERMISSIONS.staffInvite);
  const canManage = can(RBAC_PERMISSIONS.staffUpdate);

  /** The one active super admin who must stay: demoting or deactivating them is blocked. */
  const lastSuperAdminId = useMemo(() => {
    const active = allStaff.filter((m) => m.roleKey === SUPER_ADMIN_KEY && m.status === 'active');
    return active.length === 1 ? active[0].id : null;
  }, [allStaff]);

  const busy = changeRole.isPending || setStatus.isPending || logoutAll.isPending;

  const run = () => {
    if (!pending) return;
    const done = (message: string) => ({
      onSuccess: () => {
        notify(message);
        setPending(null);
      },
      onError: (e: unknown) => {
        notify(errorMessage(e), 'error');
        setPending(null);
      },
    });
    const name = pending.member.name;
    if (pending.kind === 'role') {
      changeRole.mutate(
        { userId: pending.member.id, roleId: pending.roleId },
        done(`${name} is now ${pending.roleName}. Their access has been updated.`),
      );
    } else if (pending.kind === 'status') {
      setStatus.mutate(
        { userId: pending.member.id, status: pending.status },
        done(pending.status === 'active' ? `${name} was reactivated.` : `${name} was deactivated and signed out.`),
      );
    } else {
      logoutAll.mutate(pending.member.id, done(`${name} was signed out of every session.`));
    }
  };

  const columns: Column<StaffMember>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (m) => (
        <div className="rbac-person">
          <span className="rbac-avatar" aria-hidden>{initials(m.name)}</span>
          <div className="rbac-person__text">
            <strong>{m.name}</strong>
            {m.id === selfId && <span className="rbac-you"> (you)</span>}
            <div className="rbac-muted">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => {
        const protectedAdmin = m.id === lastSuperAdminId;
        const disabled = !canManage || m.status === 'deactivated' || protectedAdmin || m.id === selfId;
        if (disabled) {
          return (
            <span title={protectedAdmin ? LAST_SUPER_ADMIN_MESSAGE : undefined}>
              {m.roleName}
            </span>
          );
        }
        return (
          <select
            className="rbac-input rbac-input--compact"
            aria-label={`Role for ${m.name}`}
            value={m.roleId}
            onChange={(e) => {
              const next = roles.find((r) => r.id === e.target.value);
              if (next && next.id !== m.roleId) {
                setPending({ kind: 'role', member: m, roleId: next.id, roleName: next.name });
              }
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (m) => <StatusBadge status={m.status} tone={STATUS_TONE[m.status]} />,
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      hideOnMobile: true,
      cell: (m) => (m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : 'Never'),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (m) => {
        if (!canManage) return null;
        const isSelf = m.id === selfId;
        const isLastAdmin = m.id === lastSuperAdminId;
        const deactivated = m.status === 'deactivated';
        const blockReason = isLastAdmin ? LAST_SUPER_ADMIN_MESSAGE : isSelf ? 'You can’t deactivate yourself' : undefined;
        return (
          <div className="rbac-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Sign ${m.name} out of all sessions`}
              title="Sign out of all sessions"
              disabled={m.status === 'invited'}
              onClick={() => setPending({ kind: 'logout', member: m })}
            >
              <LogOut size={16} />
            </button>
            {deactivated ? (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Reactivate ${m.name}`}
                title="Reactivate"
                onClick={() => setPending({ kind: 'status', member: m, status: 'active' })}
              >
                <UserCheck size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label={`Deactivate ${m.name}`}
                title={blockReason ?? 'Deactivate'}
                disabled={isLastAdmin || isSelf}
                onClick={() => setPending({ kind: 'status', member: m, status: 'deactivated' })}
              >
                <UserMinus size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const dialog = (() => {
    if (!pending) return null;
    const n = pending.member.name;
    if (pending.kind === 'role') {
      return {
        title: 'Change role?',
        tone: 'primary' as const,
        label: 'Change role',
        message: (
          <>
            Move <strong>{n}</strong> from {pending.member.roleName} to <strong>{pending.roleName}</strong>? Their
            access changes immediately and the change is recorded in the audit log.
          </>
        ),
      };
    }
    if (pending.kind === 'status') {
      const off = pending.status === 'deactivated';
      return {
        title: off ? 'Deactivate account?' : 'Reactivate account?',
        tone: off ? ('danger' as const) : ('primary' as const),
        label: off ? 'Deactivate' : 'Reactivate',
        message: off ? (
          <>
            <strong>{n}</strong> will be signed out and can’t log in until reactivated.
          </>
        ) : (
          <>
            <strong>{n}</strong> will be able to log in again with their current role.
          </>
        ),
      };
    }
    return {
      title: 'Sign out everywhere?',
      tone: 'danger' as const,
      label: 'Sign out all sessions',
      message: (
        <>
          Every active session for <strong>{n}</strong> ends now. They’ll need to log in again.
        </>
      ),
    };
  })();

  return (
    <section aria-label="Staff">
      <RbacStats
        label="Staff summary"
        items={[
          { label: 'Total staff', value: allStaff.length, icon: <Users size={18} /> },
          { label: 'Active staff', value: count('active'), icon: <UserCheck size={18} /> },
          { label: 'Invites pending', value: count('invited'), icon: <MailPlus size={18} /> },
          { label: 'Deactivated', value: count('deactivated'), icon: <UserX size={18} /> },
        ]}
      />

      <div className="rbac-toolbar">
        <RbacSearch value={query} onChange={setQuery} placeholder="Search name, email or role" label="Search staff" />
        {canInvite && (
          <button type="button" className="hcx-btn hcx-btn--primary rbac-cta" onClick={() => navigate('/admin/roles/staff/new')}>
            <UserPlus size={16} aria-hidden /> Invite staff
          </button>
        )}
      </div>

      <p className="rbac-muted rbac-intro">Invite teammates, change their role, or cut off access.</p>

      <RbacTable variant="staff">
        <DataTable
          label="Staff"
          columns={columns}
          data={staff}
          rowKey={(m) => m.id}
          loading={staffQuery.isLoading}
          error={staffQuery.isError ? errorMessage(staffQuery.error, 'Couldn’t load staff.') : null}
          onRetry={() => void staffQuery.refetch()}
          emptyTitle={query ? 'No staff match your search' : 'No staff yet'}
          emptyMessage={query ? 'Try a different name, email or role.' : 'Invite your first teammate to get started.'}
          defaultPageSize={10}
        />
      </RbacTable>

      <ConfirmDialog
        open={pending !== null && dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        tone={dialog?.tone}
        confirmLabel={dialog?.label}
        loading={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </section>
  );
};

export default StaffTab;
