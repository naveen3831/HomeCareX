import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { useUIStore } from '@/store/useUIStore';
import '@/styles/admin.css';

export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();

  const normalizedPath = pathname.replace(/\/+$/, '') || '/admin';

  // The header search bar only exists on the Dashboard. Other pages search inside themselves.
  const showGlobalSearch = normalizedPath === '/admin';

  // Every page starts with an empty page-search box.
  const setPageSearch = useUIStore((s) => s.setPageSearch);
  useEffect(() => {
    setPageSearch('');
  }, [pathname, setPageSearch]);

  return (
    <div className="admin-layout">
      <a href="#admin-main" className="sr-only">
        Skip to content
      </a>

      <Sidebar />

      <div className="admin-layout__content">
        <Header />

        {showGlobalSearch && (
          <div className="breadcrumb-bar">
            <AdminSearch />
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
