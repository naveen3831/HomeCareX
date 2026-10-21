import React from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { StaffTab } from '@/pages/admin/Roles/StaffTab';
import { RBAC_PERMISSIONS } from '@/pages/admin/Roles/rbacPermissions';
import { useFlashToast, useToast } from '@/pages/admin/Roles/useToast';
import '@/pages/admin/Roles/index.css';

/** /admin/staff: invite, change role, deactivate, sign out of all sessions. */
export const AdminStaffPage: React.FC = () => {
  const { can } = usePermissions();
  const toast = useToast();
  useFlashToast(toast.show);

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader title="Staff" description="Invite teammates, change their role, or cut off access." />
      {can(RBAC_PERMISSIONS.staffView) ? (
        <StaffTab notify={toast.show} />
      ) : (
        <p className="rbac-muted">You don’t have access to staff.</p>
      )}
      {toast.node}
    </div>
  );
};

export default AdminStaffPage;
