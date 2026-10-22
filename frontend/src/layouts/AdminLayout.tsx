import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import {
  AdminSearch,
  hasPageSearch,
} from "@/components/admin/AdminSearch";
import "@/styles/admin.css";

export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();

  const normalizedPath = pathname.replace(/\/+$/, "");

  // Hide the shared search bar on Audit Logs.
  // The page will have its own search bar above its table.
  const isAuditLogsPage =
    normalizedPath === "/admin/audit-logs" ||
    normalizedPath.startsWith("/admin/audit-logs/");

  const showPageSearch =
    hasPageSearch(pathname) && !isAuditLogsPage;

  // Pages where the shared search bar appears on the left.
  const searchLeft = [
    "/admin/manage-partners",
    "/admin/categories",
    "/admin/services",
  ].includes(normalizedPath);

  return (
    <div className="admin-layout">
      <a href="#admin-main" className="sr-only">
        Skip to content
      </a>

      <Sidebar />

      <div className="admin-layout__content">
        <Header />

        {showPageSearch && (
          <div
            className={`breadcrumb-bar${
              searchLeft ? " breadcrumb-bar--left" : ""
            }`}
          >
            <AdminSearch />

            {normalizedPath === "/admin/services" && (
              <div
                id="admin-search-slot"
                className="admin-search-slot"
              />
            )}
          </div>
        )}

        <main
          id="admin-main"
          className="admin-layout__main"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
