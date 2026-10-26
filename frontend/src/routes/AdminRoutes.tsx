import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from '@/layouts/AdminLayout';
import { RequirePermission } from '@/components/admin/PermissionGate';
import PageLoader from '@/components/common/PageLoader';

const AdminDashboardPage = lazy(() => import('@/pages/admin/Dashboard'));
const AdminLeadsPage = lazy(() => import('@/pages/admin/Leads'));
const AdminBookingsPage = lazy(() => import('@/pages/admin/Bookings'));
const AdminCustomersPage = lazy(() => import('@/pages/admin/Customers'));
const AdminCustomerDetailsPage = lazy(
  () => import('@/pages/admin/CustomerDetails')
);
const AdminPartnersPage = lazy(() => import('@/pages/admin/Partners'));
const AdminManagePartnersPage = lazy(
  () => import('@/pages/admin/ManagePartners')
);
const AdminSupportPage = lazy(() => import('@/pages/admin/Support'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/Categories'));
const AdminServicesPage = lazy(() => import('@/pages/admin/Services'));
const AdminPricingPage = lazy(() => import('@/pages/admin/Pricing'));
const AdminCouponsPage = lazy(() => import('@/pages/admin/Coupons'));
const AdminMarketingPage = lazy(() => import('@/pages/admin/Marketing'));
const AdminPaymentsPage = lazy(() => import('@/pages/admin/Payments'));
const AdminRefundsPage = lazy(() => import('@/pages/admin/Refunds'));
const AdminPayoutsPage = lazy(() => import('@/pages/admin/Payouts'));
const AdminReportsPage = lazy(() => import('@/pages/admin/Reports'));

const AdminRolesPage = lazy(() => import('@/pages/admin/Roles'));
const AdminRoleFormPage = lazy(() => import('@/pages/admin/Roles/RoleFormPage'));
const AdminInviteStaffPage = lazy(() => import('@/pages/admin/Roles/InviteStaffPage'));
const AdminStaffPage = lazy(() => import('@/pages/admin/Staff'));
const AdminAuditLogsPage = lazy(() => import('@/pages/admin/AuditLogs'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/Settings'));
const AdminProfilePage = lazy(() => import('@/pages/admin/Profile'));
const AdminNotificationsPage = lazy(
  () => import('@/pages/admin/Notifications')
);
const AdminPartnerDetailsPage = lazy(
  () => import('@/pages/admin/PartnerDetails')
);
const AccountSecurityPage = lazy(() => import('@/pages/shared/AccountSecurity'));

interface AdminRoute {
  /** Relative to /admin. Empty string is the index route. */
  path: string;
  element: React.ReactElement;
  /** Permission key. Leave out and the route stays open to every admin. */
  permission?: string;
}

const adminRoutes: AdminRoute[] = [
  { path: '', element: <AdminDashboardPage /> },

  // Operations
  { path: 'leads', element: <AdminLeadsPage /> },
  { path: 'bookings', element: <AdminBookingsPage /> },
  { path: 'customers', element: <AdminCustomersPage /> },
  { path: 'customers/:id', element: <AdminCustomerDetailsPage /> },
  { path: 'partners', element: <AdminPartnersPage /> },
  { path: 'manage-partners', element: <AdminManagePartnersPage /> },
  { path: 'partners/:id', element: <AdminPartnerDetailsPage /> },
  { path: 'support', element: <AdminSupportPage /> },

  // Catalog
  { path: 'categories', element: <AdminCategoriesPage />, permission: 'catalog:manage' },
  { path: 'services', element: <AdminServicesPage />, permission: 'catalog:manage' },
  { path: 'pricing', element: <AdminPricingPage />, permission: 'pricing:view' },

  // Coupons
  { path: 'coupons', element: <AdminCouponsPage /> },
  { path: 'coupons/create', element: <AdminCouponsPage /> },
  { path: 'coupons/:id/edit', element: <AdminCouponsPage /> },

  // Marketing
  { path: 'marketing', element: <AdminMarketingPage /> },
  { path: 'marketing/create', element: <AdminMarketingPage /> },
  { path: 'marketing/:id/edit', element: <AdminMarketingPage /> },

  // Finance
  { path: 'payments', element: <AdminPaymentsPage /> },
  { path: 'refunds', element: <AdminRefundsPage /> },
  // Refund details: required for the Review button.
  // Keep this route after the base refunds route.
  { path: 'refunds/:id', element: <AdminRefundsPage /> },
  { path: 'payouts', element: <AdminPayoutsPage /> },

  // Reporting
  { path: 'reports', element: <AdminReportsPage /> },

  // System
  { path: 'roles', element: <AdminRolesPage />, permission: 'roles:view' },
  { path: 'roles/new', element: <AdminRoleFormPage />, permission: 'roles:create' },
  { path: 'roles/:id', element: <AdminRoleFormPage />, permission: 'roles:view' },
  { path: 'staff', element: <AdminStaffPage />, permission: 'staff:view' },
  { path: 'staff/new', element: <AdminInviteStaffPage />, permission: 'staff:create' },
  { path: 'audit-logs', element: <AdminAuditLogsPage />, permission: 'audit:view' },
  { path: 'audit-logs/:id', element: <AdminAuditLogsPage />, permission: 'audit:view' },
  { path: 'settings', element: <AdminSettingsPage />, permission: 'settings:manage' },

  // Old URLs keep working.
  { path: 'roles-permissions', element: <Navigate to="/admin/roles" replace /> },
  { path: 'roles/staff/new', element: <Navigate to="/admin/staff/new" replace /> },

  // Account security
  { path: 'security', element: <AccountSecurityPage /> },
  { path: 'account/security', element: <AccountSecurityPage /> },
  { path: 'settings/security', element: <AccountSecurityPage /> },

  // Header-only pages
  { path: 'profile', element: <AdminProfilePage /> },
  { path: 'notifications', element: <AdminNotificationsPage /> },
];

const NotFound: React.FC = () => (
  <div className="admin-page-container">
    <h1 className="hcx-page-header__title">Page not found</h1>
    <p className="hcx-page-header__desc">That admin page doesn&apos;t exist.</p>
  </div>
);

export const AdminRoutes: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<AdminLayout />}>
        {adminRoutes.map(({ path, element, permission }) => {
          const guarded = permission ? (
            <RequirePermission permission={permission}>{element}</RequirePermission>
          ) : (
            element
          );

          return path === '' ? (
            <Route key="index" index element={guarded} />
          ) : (
            <Route key={path} path={path} element={guarded} />
          );
        })}

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  </Suspense>
);

export default AdminRoutes;