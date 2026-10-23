
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminSearch } from '@/components/admin/AdminSearch';
import '@/styles/admin.css';

export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();

  // Customers has its own search bar under the page title.
  const hideGlobalSearch =
    pathname === '/admin/customers' ||
    pathname.startsWith('/admin/customers/');

  // These pages position search on the left under the navbar.
  const normalizedPath = pathname.replace(/\/+$/, '');

  const searchLeft = [
    '/admin/manage-partners',
    '/admin/categories',
    '/admin/services',
  ].includes(normalizedPath);

  return (
    <div className="admin-layout">
      <a href="#admin-main" className="sr-only">
        Skip to content
      </a>

      <Sidebar />

      <div className="admin-layout__content">
        <Header />

        {!hideGlobalSearch && (
          <div
            className={`breadcrumb-bar${
              searchLeft ? ' breadcrumb-bar--left' : ''
            }`}
          >
            <AdminSearch />

            {normalizedPath === '/admin/services' && (
              <div
                id="admin-search-slot"
                className="admin-search-slot"
              />
            )}
          </div>
        )}

        <main id="admin-main" className="admin-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  </div>
  );
};

export default AdminLayout;
