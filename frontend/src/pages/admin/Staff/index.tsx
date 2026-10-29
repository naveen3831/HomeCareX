import React from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { StaffTab } from '@/pages/admin/Roles/StaffTab';
import { RBAC_PERMISSIONS } from '@/pages/admin/Roles/rbacPermissions';
import { useFlashToast, useToast } from '@/pages/admin/Roles/useToast';


import '../Roles/index.css';

/** /admin/staff: staff list, role changes, deactivation and invites. Lives on its own page (no tabs). */
export const AdminStaffPage: React.FC = () => {
  const { can } = usePermissions();
  const toast = useToast();
  useFlashToast(toast.show);

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader
        title="Staff"
        description="Manage admin staff accounts and their roles."
      />
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