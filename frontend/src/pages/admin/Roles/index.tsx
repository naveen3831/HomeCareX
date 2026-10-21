import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { RolesTab } from './RolesTab';
import { RBAC_PERMISSIONS } from './rbacPermissions';
import { useFlashToast, useToast } from './useToast';
import './index.css';

/** /admin/roles: role list, permission grid entry points, system role protection. */
export const AdminRolesPage: React.FC = () => {
  const { can } = usePermissions();
  const [params] = useSearchParams();
  const toast = useToast();
  useFlashToast(toast.show);

  // Old bookmark: /admin/roles?tab=staff now lives on its own page.
  if (params.get('tab') === 'staff') return <Navigate to="/admin/staff" replace />;

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader title="Roles & Permissions" description="Decide which parts of the admin panel each role can use." />
      {can(RBAC_PERMISSIONS.rolesView) ? (
        <RolesTab notify={toast.show} />
      ) : (
        <p className="rbac-muted">You don’t have access to roles.</p>
      )}
      {toast.node}
    </div>
  );
};

export default AdminRolesPage;
