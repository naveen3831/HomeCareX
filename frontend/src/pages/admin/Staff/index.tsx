
import React from "react";

import { PageHeader } from "@/components/admin/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { StaffTab } from "../Roles/StaffTab";
import { RBAC_PERMISSIONS } from "../Roles/rbacPermissions";
import {
  useFlashToast,
  useToast,
} from "../Roles/useToast";

import "../Roles/index.css";

/**
 * /admin/staff
 * Staff list, role changes, deactivation, and invitations.
 * This page lives independently without role-management tabs.
 */
export const AdminStaffPage: React.FC = () => {
  const { can } = usePermissions();
  const toast = useToast();

  useFlashToast(toast.show);

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader
        title="Staff"
        description="Invite teammates, change their role, deactivate them or sign them out."
      />

      {can(RBAC_PERMISSIONS.staffView) ? (
        <StaffTab notify={toast.show} />
      ) : (
        <p className="rbac-muted">
          You don’t have access to staff.
        </p>
      )}

      {toast.node}
    </div>
  );
};

export default AdminStaffPage;
