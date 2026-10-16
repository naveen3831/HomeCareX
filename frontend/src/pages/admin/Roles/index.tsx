import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { RolesTab } from './RolesTab';
import { StaffTab } from './StaffTab';
import { RBAC_PERMISSIONS } from './rbacPermissions';
import { useToast } from './useToast';
import './index.css';

type TabKey = 'roles' | 'staff';

/** /admin/roles (Roles tab) and /admin/roles?tab=staff (Staff tab). */
export const AdminRolesPage: React.FC = () => {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // A form page sends the success message here via navigation state; show it once, then clear it.
  const flash = (location.state as { toast?: string } | null)?.toast;
  useEffect(() => {
    if (!flash) return;
    toast.show(flash);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    ...(can(RBAC_PERMISSIONS.rolesView) ? [{ key: 'roles' as const, label: 'Roles', icon: <ShieldCheck size={16} aria-hidden /> }] : []),
    ...(can(RBAC_PERMISSIONS.staffView) ? [{ key: 'staff' as const, label: 'Staff', icon: <Users size={16} aria-hidden /> }] : []),
  ];

  const requested = params.get('tab') === 'staff' ? 'staff' : 'roles';
  const active: TabKey | undefined = tabs.find((t) => t.key === requested)?.key ?? tabs[0]?.key;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Keep the URL honest if someone opens a tab they can't see.
  useEffect(() => {
    if (active && active !== requested) {
      setParams(active === 'staff' ? { tab: 'staff' } : {}, { replace: true });
    }
  }, [active, requested, setParams]);

  const select = (key: TabKey) => setParams(key === 'staff' ? { tab: 'staff' } : {});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    select(next.key);
    tabRefs.current[next.key]?.focus();
  };

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader title="Roles & Staff" description="Control who can access which parts of the admin panel." />

      {!active ? (
        <p className="rbac-muted">You don’t have access to roles or staff.</p>
      ) : (
        <>
          <div
            className="rbac-tabs"
            role="tablist"
            aria-label="Roles and staff"
            style={{ '--n': tabs.length, '--i': Math.max(0, tabs.findIndex((t) => t.key === active)) } as React.CSSProperties}
          >
            <span className="rbac-tabs__thumb" aria-hidden />
            {tabs.map((t, i) => (
              <button
                key={t.key}
                ref={(el) => { tabRefs.current[t.key] = el; }}
                type="button"
                role="tab"
                id={`rbac-tab-${t.key}`}
                aria-selected={active === t.key}
                aria-controls={`rbac-panel-${t.key}`}
                tabIndex={active === t.key ? 0 : -1}
                className={`rbac-tab${active === t.key ? ' is-active' : ''}`}
                onClick={() => select(t.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`rbac-panel-${active}`} aria-labelledby={`rbac-tab-${active}`}>
            {active === 'roles' ? <RolesTab notify={toast.show} /> : <StaffTab notify={toast.show} />}
          </div>
        </>
      )}
      {toast.node}
    </div>
  );
};

export default AdminRolesPage;