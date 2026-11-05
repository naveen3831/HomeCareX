import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "@/layouts/AdminLayout";
import { RequirePermission } from "@/components/admin/PermissionGate";
import PageLoader from "@/components/common/PageLoader";

// Dashboard
const AdminDashboardPage = lazy(
  () => import("@/pages/admin/Dashboard"),
);

// Operations
const AdminLeadsPage = lazy(() => import("@/pages/admin/Leads"));
const AdminBookingsPage = lazy(() => import("@/pages/admin/Bookings"));
const AdminCustomersPage = lazy(() => import("@/pages/admin/Customers"));
const AdminCustomerDetailsPage = lazy(
  () => import("@/pages/admin/CustomerDetails"),
);
const AdminPartnersPage = lazy(() => import("@/pages/admin/Partners"));
const AdminManagePartnersPage = lazy(
  () => import("@/pages/admin/ManagePartners"),
);
const AdminPartnerDetailsPage = lazy(
  () => import("@/pages/admin/PartnerDetails"),
);
const AdminSupportPage = lazy(() => import("@/pages/admin/Support"));
const AdminSupportTicketPage = lazy(
  () => import("@/pages/admin/Support/Ticketdetail"),
);

// Catalog
const AdminCategoriesPage = lazy(
  () => import("@/pages/admin/Categories"),
);
const AdminServicesPage = lazy(() => import("@/pages/admin/Services"));
const AdminPricingPage = lazy(() => import("@/pages/admin/Pricing"));

// Coupons and marketing
const AdminCouponsPage = lazy(() => import("@/pages/admin/Coupons"));
const AdminMarketingPage = lazy(() => import("@/pages/admin/Marketing"));

// Finance
const AdminPaymentsPage = lazy(() => import("@/pages/admin/Payments"));
const AdminPaymentDetailsPage = lazy(
  () => import("@/pages/admin/Payments/PaymentDetails"),
);
const AdminRefundsPage = lazy(() => import("@/pages/admin/Refunds"));
const AdminPayoutsPage = lazy(() => import("@/pages/admin/Payouts"));

// Quality and reporting
const AdminReviewsPage = lazy(() => import("@/pages/admin/Reviews"));
const AdminReportsPage = lazy(() => import("@/pages/admin/Reports"));
const AdminReportDetailsPage = lazy(() => import("@/pages/admin/Reports/ReportDetails"));

// Roles and staff
const AdminRolesPage = lazy(() => import("@/pages/admin/Roles"));
const AdminRoleFormPage = lazy(
  () => import("@/pages/admin/Roles/RoleFormPage"),
);
const AdminInviteStaffPage = lazy(
  () => import("@/pages/admin/Roles/InviteStaffPage"),
);
const AdminStaffPage = lazy(() => import("@/pages/admin/Staff"));

// Audit logs
const AdminAuditLogsPage = lazy(
  () => import("@/pages/admin/AuditLogs"),
);

// Settings and account pages
const AdminSettingsPage = lazy(() => import("@/pages/admin/Settings"));
const AdminProfilePage = lazy(() => import("@/pages/admin/Profile"));
const AdminNotificationsPage = lazy(
  () => import("@/pages/admin/Notifications"),
);
const AccountSecurityPage = lazy(
  () => import("@/pages/shared/AccountSecurity"),
);

interface AdminRoute {
  /** Relative to /admin. An empty path is the index route. */
  path: string;
  element: React.ReactElement;
  permission?: string;
}

const adminRoutes: AdminRoute[] = [
  // Dashboard
  {
    path: "",
    element: <AdminDashboardPage />,
  },

  // Operations
  {
    path: "leads",
    element: <AdminLeadsPage />,
    permission: "leads:view",
  },

  // Bookings list
  {
    path: "bookings",
    element: <AdminBookingsPage />,
    permission: "bookings:view",
  },

  // Individual booking details.
  // Uses the same Bookings component and reads bookingId from the URL.
  {
    path: "bookings/:bookingId",
    element: <AdminBookingsPage />,
    permission: "bookings:view",
  },

  // Assign partner, override status and cancel booking:
  // bookings/:bookingId/assign | status | cancel
  {
    path: "bookings/:bookingId/:action",
    element: <AdminBookingsPage />,
    permission: "bookings:view",
  },

  {
    path: "customers",
    element: <AdminCustomersPage />,
    permission: "customers:view",
  },
  {
    path: "customers/:id",
    element: <AdminCustomerDetailsPage />,
    permission: "customers:view",
  },
  {
    path: "partners",
    element: <AdminPartnersPage />,
    permission: "partners:view",
  },
  {
    path: "manage-partners",
    element: <AdminManagePartnersPage />,
    permission: "partners:view",
  },
  {
    path: "partners/:id",
    element: <AdminPartnerDetailsPage />,
    permission: "partners:view",
  },
  {
    path: "support",
    element: <AdminSupportPage />,
    permission: "tickets:view",
  },
  {
    path: "support/:id",
    element: <AdminSupportTicketPage />,
    permission: "tickets:view",
  },

  // Catalog
  {
    path: "categories",
    element: <AdminCategoriesPage />,
    permission: "catalog:manage",
  },
  {
    path: "services",
    element: <AdminServicesPage />,
    permission: "catalog:manage",
  },
  {
    path: "pricing",
    element: <AdminPricingPage />,
    permission: "pricing:view",
  },

  // Coupons
  {
    path: "coupons",
    element: <AdminCouponsPage />,
    permission: "coupons:view",
  },
  {
    path: "coupons/create",
    element: <AdminCouponsPage />,
    permission: "coupons:create",
  },
  {
    path: "coupons/:id/edit",
    element: <AdminCouponsPage />,
    permission: "coupons:update",
  },

  // Marketing
  {
    path: "marketing",
    element: <AdminMarketingPage />,
    permission: "marketing:view",
  },
  {
    path: "marketing/create",
    element: <AdminMarketingPage />,
    permission: "marketing:manage",
  },
  {
    path: "marketing/:id/edit",
    element: <AdminMarketingPage />,
    permission: "marketing:manage",
  },

  // Finance
  {
    path: "payments",
    element: <AdminPaymentsPage />,
    permission: "payments:read",
  },
  {
    path: "payments/:id",
    element: <AdminPaymentDetailsPage />,
    permission: "payments:read",
  },
  {
    path: "refunds",
    element: <AdminRefundsPage />,
    permission: "refunds:view",
  },
  {
    path: "refunds/:id",
    element: <AdminRefundsPage />,
    permission: "refunds:view",
  },
  {
    path: "payouts",
    element: <AdminPayoutsPage />,
    permission: "payouts:view",
  },
  {
    path: "payouts/:id",
    element: <AdminPayoutsPage />,
    permission: "payouts:view",
  },

  // Quality and reporting
  {
    path: "reviews",
    element: <AdminReviewsPage />,
    permission: "reviews:view",
  },
  {
    path: "reports",
    element: <AdminReportsPage />,
    permission: "reports:view",
  },
  {
    path: "reports/:report/:id",
    element: <AdminReportDetailsPage />,
    permission: "reports:view",
  },

  // Roles and staff
  {
    path: "roles",
    element: <AdminRolesPage />,
    permission: "roles:view",
  },
  {
    path: "roles/new",
    element: <AdminRoleFormPage />,
    permission: "roles:create",
  },
  {
    path: "roles/:id",
    element: <AdminRoleFormPage />,
    permission: "roles:view",
  },
  {
    path: "staff",
    element: <AdminStaffPage />,
    permission: "staff:view",
  },
  {
    path: "staff/new",
    element: <AdminInviteStaffPage />,
    permission: "staff:create",
  },

  // Audit logs
  {
    path: "audit-logs",
    element: <AdminAuditLogsPage />,
    permission: "audit:view",
  },
  {
    path: "audit-logs/:id",
    element: <AdminAuditLogsPage />,
    permission: "audit:view",
  },

  // Settings
  {
    path: "settings",
    element: <AdminSettingsPage />,
    permission: "settings:manage",
  },

  // Account pages
  {
    path: "profile",
    element: <AdminProfilePage />,
  },
  {
    path: "notifications",
    element: <AdminNotificationsPage />,
  },
  {
    path: "security",
    element: <AccountSecurityPage />,
  },
  {
    path: "account/security",
    element: <AccountSecurityPage />,
  },
  {
    path: "settings/security",
    element: <AccountSecurityPage />,
  },

  // Legacy URLs
  {
    path: "roles-permissions",
    element: <Navigate to="/admin/roles" replace />,
  },
  {
    path: "roles/staff/new",
    element: <Navigate to="/admin/staff/new" replace />,
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

          if (path === "") {
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