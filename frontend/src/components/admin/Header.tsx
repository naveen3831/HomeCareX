import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { ProfileMenu } from '@/components/admin/ProfileMenu';

export interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  href?: string;
}

interface HeaderProps {
  notifications?: HeaderNotification[];
}

/** Sticky admin header: menu/collapse, breadcrumbs, help, the live notification bell and the avatar menu. (Search sits in the bar under it.) */
export const Header: React.FC<HeaderProps> = ({ notifications: _notifications = [] }) => {
  const { pathname } = useLocation();
  const isCustomerDetails = /^\/admin\/customers\/[^/]+/.test(pathname);
  const isCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu);

  return (
    <header className="admin-topbar">
      <button type="button" onClick={toggleMobileMenu} className="icon-btn mobile-only" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <button
        type="button"
        onClick={toggleSidebar}
        className="icon-btn desktop-only"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      <div className={`admin-topbar__crumbs${isCustomerDetails ? ' admin-topbar__crumbs--hide-mobile' : ''}`}>
        <Breadcrumbs />
      </div>

      <div className="topbar-right">
        <Link to="/admin/support" className="icon-btn" aria-label="Help and support" title="Help and support">
          <HelpCircle size={20} />
        </Link>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
};

export default Header;
