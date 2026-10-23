import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from '@/layouts/AdminLayout';
import { RequirePermission } from '@/components/admin/PermissionGate';
import { findAdminPage } from '@/config/adminNav';

import AdminDashboardPage from '@/pages/admin/Dashboard';
import AdminLeadsPage from '@/pages/admin/Leads';
import AdminBookingsPage from '@/pages/admin/Bookings';
import AdminCustomersPage from '@/pages/admin/Customers';
import AdminCustomerDetailsPage from '@/pages/admin/CustomerDetails';
import AdminPartnersPage from '@/pages/admin/Partners';
import AdminManagePartnersPage from '@/pages/admin/ManagePartners';
import AdminSupportPage from '@/pages/admin/Support';
import AdminSupportTicketPage from '@/pages/admin/Support/Ticketdetail';
import AdminCategoriesPage from '@/pages/admin/Categories';
import AdminServicesPage from '@/pages/admin/Services';
import AdminPricingPage from '@/pages/admin/Pricing';
import AdminCouponsPage from '@/pages/admin/Coupons';
import AdminMarketingPage from '@/pages/admin/Marketing';
import AdminPaymentsPage from '@/pages/admin/Payments';
import AdminPaymentDetailsPage from '@/pages/admin/Payments/PaymentDetails';
import AdminRefundsPage from '@/pages/admin/Refunds';
import AdminPayoutsPage from '@/pages/admin/Payouts';
import AdminReviewsPage from '@/pages/admin/Reviews';
import AdminReportsPage from '@/pages/admin/Reports';
import AdminRolesPage from '@/pages/admin/Roles';
import AdminStaffPage from '@/pages/admin/Staff';
import AdminRoleFormPage from '@/pages/admin/Roles/RoleFormPage';
import AdminInviteStaffPage from '@/pages/admin/Roles/InviteStaffPage';
import AdminAuditLogsPage from '@/pages/admin/AuditLogs';
import AdminSettingsPage from '@/pages/admin/Settings';
import AdminProfilePage from '@/pages/admin/Profile';
import AdminNotificationsPage from '@/pages/admin/Notifications';
import AdminPartnerDetailsPage from '@/pages/admin/PartnerDetails';
import AccountSecurityPage from '@/pages/shared/AccountSecurity';

interface AdminRoute {
  /** Relative to /admin. Empty string is the index route. */
  path: string;
  element: React.ReactElement;
  /** Permission key. Routes without a permission remain unguarded here. */
  permission?: string | string[];
}

export const adminRoutes: AdminRoute[] = [
  // Overview
  {
    path: '',
    element: <AdminDashboardPage />,
  },

  // Operations
  {
    path: 'leads',
    element: <AdminLeadsPage />,
  },
  {
    path: 'bookings',
    element: <AdminBookingsPage />,
  },
  {
    path: 'customers',
    element: <AdminCustomersPage />,
  },
  {
    path: 'customers/:id',
    element: <AdminCustomerDetailsPage />,
  },
  {
    path: 'partners',
    element: <AdminPartnersPage />,
  },
  {
    path: 'manage-partners',
    element: <AdminManagePartnersPage />,
  },
  {
    path: 'partners/:id',
    element: <AdminPartnerDetailsPage />,
  },
  {
    path: 'support',
    element: <AdminSupportPage />,
  },
  {
    path: 'support/:id',
    element: <AdminSupportTicketPage />,
  },

  // Catalog
  {
    path: 'categories',
    element: <AdminCategoriesPage />,
    permission: 'catalog:manage',
  },
  {
    path: 'services',
    element: <AdminServicesPage />,
    permission: 'catalog:manage',
  },
  {
    path: 'pricing',
    element: <AdminPricingPage />,
    permission: 'pricing:manage',
  },

  // Coupons
  {
    path: 'coupons',
    element: <AdminCouponsPage />,
  },
  {
    path: 'coupons/create',
    element: <AdminCouponsPage />,
  },
  {
    path: 'coupons/:id/edit',
    element: <AdminCouponsPage />,
  },

  // Marketing
  {
    path: 'marketing',
    element: <AdminMarketingPage />,
  },
  {
    path: 'marketing/create',
    element: <AdminMarketingPage />,
  },
  {
    path: 'marketing/:id/edit',
    element: <AdminMarketingPage />,
  },

  // Finance: Payments
  {
    path: 'payments',
    element: <AdminPaymentsPage />,
    permission: 'payments:read',
  },
  {
    path: 'payments/:id',
    element: <AdminPaymentDetailsPage />,
    permission: 'payments:read',
  },

  // Finance: Refunds
  {
    path: 'refunds',
    element: <AdminRefundsPage />,
  },
  {
    path: 'refunds/:id',
    element: <AdminRefundsPage />,
  },

  // Finance: Payouts
  {
    path: 'payouts',
    element: <AdminPayoutsPage />,
  },
  {
    path: 'payouts/:id',
    element: <AdminPayoutsPage />,
  },

  // Quality and reporting
  {
    path: 'reviews',
    element: <AdminReviewsPage />,
  },
  {
    path: 'reports',
    element: <AdminReportsPage />,
  },

  // System
  {
    path: 'roles',
    element: <AdminRolesPage />,
    permission: 'roles:view',
  },
  {
    path: 'staff',
    element: <AdminStaffPage />,
    permission: 'staff:view',
  },
  // Full pages (sidebar stays visible): create / invite / edit.
  {
    path: 'roles/new',
    element: <AdminRoleFormPage />,
    permission: 'roles:create',
  },
  {
    path: 'staff/new',
    element: <AdminInviteStaffPage />,
    permission: 'staff:create',
  },
  {
    path: 'roles/:id',
    element: <AdminRoleFormPage />,
    permission: 'roles:view',
  },
  // Old URLs keep working.
  {
    path: 'roles-permissions',
    element: <Navigate to="/admin/roles" replace />,
  },
  {
    path: 'roles/staff/new',
    element: <Navigate to="/admin/staff/new" replace />,
  },
  {
    path: 'audit-logs',
    element: <AdminAuditLogsPage />,
  },
  {
    path: 'settings',
    element: <AdminSettingsPage />,
    permission: 'settings:manage',
  },

  // Header pages
  {
    path: 'profile',
    element: <AdminProfilePage />,
  },
  {
    path: 'security',
    element: <AccountSecurityPage />,
  },
  {
    path: 'account/security',
    element: <AccountSecurityPage />,
  },
  {
    path: 'settings/security',
    element: <AccountSecurityPage />,
  },
  {
    path: 'notifications',
    element: <AdminNotificationsPage />,
  },
];

const NotFound: React.FC = () => (
  <div className="admin-page-container">
    <h1 className="hcx-page-header__title">Page not found</h1>
    <p className="hcx-page-header__desc">
      That admin page doesn't exist.
    </p>
  </div>
);

export const AdminRoutes: React.FC = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      {adminRoutes.map(({ path, element, permission: explicit }) => {
        // A route without its own permission inherits the one on its sidebar entry,
        // so a custom role that hides a page from the sidebar also blocks the URL.
        const permission = explicit ?? findAdminPage(`/admin/${path}`)?.permission;
        const guardedElement = permission ? (
          <RequirePermission permission={permission}>
            {element}
          </RequirePermission>
        ) : (
          element
        );

        if (path === '') {
          return (
            <Route
              key="admin-index"
              index
              element={guardedElement}
            />
          );
        }

        return (
          <Route
            key={path}
            path={path}
            element={guardedElement}
          />
        );
      })}

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);

export default AdminRoutes;
