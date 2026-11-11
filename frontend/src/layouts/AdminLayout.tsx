import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import SosAlertOverlay from '@/components/admin/SosAlertOverlay';
import { useUIStore } from '@/store/useUIStore';
import { useAutoDragScroll } from '@/hooks/useAutoDragScroll';
import '@/styles/admin.css';

export const AdminLayout: React.FC = () => {
  const { pathname } = useLocation();
  // Wide tables on every admin page can be dragged sideways with a mouse (phone view on desktop).
  const mainRef = useAutoDragScroll<HTMLElement>();

  const normalizedPath = pathname.replace(/\/+$/, '') || '/admin';

  // The header search bar only exists on the Dashboard. Other pages search inside themselves.
  const showGlobalSearch = normalizedPath === '/admin';

  // The Profile page on phones has its own header card, so the top bar (breadcrumbs, help, bell) is hidden there.
  const isProfile = normalizedPath === '/admin/profile';

  // Every page starts with an empty page-search box.
  const setPageSearch = useUIStore((s) => s.setPageSearch);
  useEffect(() => {
    setPageSearch('');
  }, [pathname, setPageSearch]);

  return (
    <div
      className={`admin-layout${showGlobalSearch ? ' admin-layout--home' : ''}${isProfile ? ' admin-layout--profile' : ''}`}
    >
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

        <main id="admin-main" className="admin-layout__main" ref={mainRef}>
          <Outlet />
        </main>
      </div>

      <AdminBottomNav />
      <SosAlertOverlay />
    </div>
  );
};

export default AdminLayout;