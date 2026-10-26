import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from '@/layouts/AdminLayout';
import { RequirePermission } from '@/components/admin/PermissionGate';
import PageLoader from '@/components/common/PageLoader';

// Dashboard
const AdminDashboardPage = lazy(() => import('@/pages/admin/Dashboard'));

// Operations
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
const AdminPartnerDetailsPage = lazy(
  () => import('@/pages/admin/PartnerDetails')
);
const AdminSupportPage = lazy(() => import('@/pages/admin/Support'));

// Catalog
const AdminCategoriesPage = lazy(() => import('@/pages/admin/Categories'));
const AdminServicesPage = lazy(() => import('@/pages/admin/Services'));
const AdminPricingPage = lazy(() => import('@/pages/admin/Pricing'));

// Coupons and marketing
const AdminCouponsPage = lazy(() => import('@/pages/admin/Coupons'));
const AdminMarketingPage = lazy(() => import('@/pages/admin/Marketing'));

// Finance
const AdminPaymentsPage = lazy(() => import('@/pages/admin/Payments'));
const AdminRefundsPage = lazy(() => import('@/pages/admin/Refunds'));
const AdminPayoutsPage = lazy(() => import('@/pages/admin/Payouts'));

// Quality and reporting
const AdminReviewsPage = lazy(() => import('@/pages/admin/Reviews'));
const AdminReportsPage = lazy(() => import('@/pages/admin/Reports'));

<<<<<<< HEAD
// Roles, staff, and audit logs
const AdminRolesPermissionsPage = lazy(
  () => import('@/pages/admin/RolesPermissions')
);
=======
const AdminRolesPage = lazy(() => import('@/pages/admin/Roles'));
const AdminRoleFormPage = lazy(() => import('@/pages/admin/Roles/RoleFormPage'));
const AdminInviteStaffPage = lazy(() => import('@/pages/admin/Roles/InviteStaffPage'));
>>>>>>> origin/develop
const AdminStaffPage = lazy(() => import('@/pages/admin/Staff'));
const AdminAuditLogsPage = lazy(() => import('@/pages/admin/AuditLogs'));

// Settings and account pages
const AdminSettingsPage = lazy(() => import('@/pages/admin/Settings'));
const AdminProfilePage = lazy(() => import('@/pages/admin/Profile'));
const AdminNotificationsPage = lazy(
  () => import('@/pages/admin/Notifications')
);
const AccountSecurityPage = lazy(
  () => import('@/pages/shared/AccountSecurity')
);
<<<<<<< HEAD
=======
const AccountSecurityPage = lazy(() => import('@/pages/shared/AccountSecurity'));
>>>>>>> origin/develop

interface AdminRoute {
  /** Relative to /admin. An empty path is the index route. */
  path: string;
  element: React.ReactElement;
  /** Routes without a permission remain unguarded. */
  permission?: string;
}

const adminRoutes: AdminRoute[] = [
  // Dashboard
  { path: '', element: <AdminDashboardPage /> },

  // Operations
  { path: 'leads', element: <AdminLeadsPage /> },
  { path: 'bookings', element: <AdminBookingsPage /> },
  { path: 'customers', element: <AdminCustomersPage /> },
  { path: 'customers/:id', element: <AdminCustomerDetailsPage /> },
  { path: 'partners', element: <AdminPartnersPage /> },
  { path: 'partners/:id', element: <AdminPartnerDetailsPage /> },
  { path: 'manage-partners', element: <AdminManagePartnersPage /> },
  { path: 'support', element: <AdminSupportPage /> },

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
  { path: 'pricing', element: <AdminPricingPage /> },

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
  { path: 'refunds/:id', element: <AdminRefundsPage /> },
  { path: 'payouts', element: <AdminPayoutsPage /> },

  // Quality and reporting
  { path: 'reviews', element: <AdminReviewsPage /> },
  { path: 'reports', element: <AdminReportsPage /> },

  // Roles and permissions
  { path: 'roles-permissions', element: <AdminRolesPermissionsPage /> },

  // Staff
  {
    path: 'staff',
    element: <AdminStaffPage />,
    permission: 'staff:view',
  },

  // Audit logs
  { path: 'audit-logs', element: <AdminAuditLogsPage /> },

  // Settings
  {
    path: 'audit-logs/:id',
    element: <AdminAuditLogsPage />,
  },
  {
    path: 'settings',
    element: <AdminSettingsPage />,
    permission: 'settings:manage',
  },
<<<<<<< HEAD

  // Account security
=======
>>>>>>> origin/develop
  { path: 'security', element: <AccountSecurityPage /> },
  { path: 'account/security', element: <AccountSecurityPage /> },
  { path: 'settings/security', element: <AccountSecurityPage /> },

  // Header pages
  { path: 'profile', element: <AdminProfilePage /> },
  { path: 'notifications', element: <AdminNotificationsPage /> },

  // Legacy redirects
  {
    path: 'roles',
    element: <Navigate to="/admin/roles-permissions" replace />,
  },
  {
    path: 'roles/new',
    element: <Navigate to="/admin/roles-permissions" replace />,
  },
  {
    path: 'roles/staff/new',
    element: <Navigate to="/admin/staff" replace />,
  },
  {
    path: 'roles/:id',
    element: <Navigate to="/admin/roles-permissions" replace />,
  },
];

const NotFound: React.FC = () => (
  <div className="admin-page-container">
    <h1 className="hcx-page-header__title">Page not found</h1>
    <p className="hcx-page-header__desc">
      That admin page doesn&apos;t exist.
    </p>
  </div>
);

export const AdminRoutes: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<AdminLayout />}>
        {adminRoutes.map(({ path, element, permission }) => {
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
  </Suspense>
);

export default AdminRoutes;
