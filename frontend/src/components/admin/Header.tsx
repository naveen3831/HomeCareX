import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { ProfileMenu } from '@/components/admin/ProfileMenu';

  const toggleMobileMenu = useUIStore(
    (state) => state.toggleMobileMenu,
  );

  // Hide customer-detail breadcrumbs on mobile.
  // The corresponding CSS class controls the breakpoint.
  const isCustomerDetails =
    /^\/admin\/customers\/[^/]+/.test(pathname);

/** Sticky admin header with navigation, breadcrumbs, help, notifications, and the profile menu. */
export const Header: React.FC<HeaderProps> = ({ notifications = [] }) => {
  const { pathname } = useLocation();
  const isCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleMobileMenu = useUIStore((state) => state.toggleMobileMenu);
  const isCustomerDetails = /^\/admin\/customers\/[^/]+/.test(pathname);

  // Notifications are rendered by NotificationBell; keep the prop for existing callers.
  void notifications;

  return (
    <header className="admin-topbar">
      <button
        type="button"
        onClick={toggleMobileMenu}
        className="icon-btn mobile-only"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={toggleSidebar}
        className="icon-btn desktop-only"
        aria-label={
          isCollapsed ? "Expand sidebar" : "Collapse sidebar"
        }
      >
        {isCollapsed ? (
          <PanelLeftOpen size={20} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={20} aria-hidden="true" />
        )}
      </button>

      <div
        className={`admin-topbar__crumbs${
          isCustomerDetails ? ' admin-topbar__crumbs--hide-mobile' : ''
        }`}
      >
        <Breadcrumbs />
      </div>

      <div className="topbar-right">
        <Link
          to="/admin/support"
          className="icon-btn"
          aria-label="Help and support"
          title="Help and support"
        >
          <HelpCircle size={20} />
        </Link>

        <NotificationBell />

        <ProfileMenu />
      </div>
    </header>
  );
};

export default Header;
