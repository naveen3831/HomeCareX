import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminSearch, hasPageSearch } from '@/components/admin/AdminSearch';
import '@/styles/admin.css';

export const AdminLayout: React.FC = () => {
  // The "Search pages…" jump bar is gone. The bar below the header only stays on the pages whose own
  // table is filtered by it (Partners, Manage Partners, Audit Logs, Categories, Services).
  const { pathname } = useLocation();
  const showPageSearch = hasPageSearch(pathname);
  // Manage Partners, Categories and Services: search sits on the left of the row under the navbar.
  const searchLeft = ['/admin/manage-partners', '/admin/categories', '/admin/services'].includes(pathname.replace(/\/+$/, ''));
  return (
  <div className="admin-layout">
    <a href="#admin-main" className="sr-only">Skip to content</a>
    <Sidebar />
    <div className="admin-layout__content">
      <Header />
      {showPageSearch && (
        <div className={`breadcrumb-bar${searchLeft ? ' breadcrumb-bar--left' : ''}`}>
          <AdminSearch />
          {pathname.replace(/\/+$/, '') === '/admin/services' && <div id="admin-search-slot" className="admin-search-slot" />}
        </div>
      )}
      <main id="admin-main" className="admin-layout__main">
        <Outlet />
      </main>
    </div>
  </div>
  );
};

export default AdminLayout;