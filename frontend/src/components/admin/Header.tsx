import React from 'react';
<<<<<<< HEAD
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { ProfileMenu } from '@/components/admin/ProfileMenu';
=======
import { useLocation } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { useUIStore } from '@/store/useUIStore';
<<<<<<< HEAD
import { NotificationBell } from '@/components/admin/NotificationBell';
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  /** Optional notifications for compatibility with existing callers. */
  notifications?: {
    id: string;
    title: string;
    time: string;
    href?: string;
  }[];
}

/**
 * Sticky admin header with mobile navigation,
 * desktop sidebar controls, breadcrumbs, and notifications.
 */
export const Header: React.FC<HeaderProps> = ({
  notifications = [],
}) => {
  const { pathname } = useLocation();

  const isCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleMobileMenu = useUIStore((state) => state.toggleMobileMenu);

  // Hide customer-detail breadcrumbs on mobile; CSS handles the breakpoint.
  const isCustomerDetails = /^\/admin\/customers\/[^/]+/.test(pathname);

  // NotificationBell reads and displays notifications independently.
  // Keep the optional prop for compatibility with existing callers.
  void notifications;
=======
import { Breadcrumbs } from '@/components/admin/Breadcrumbs';
import { NotificationBell } from '@/components/admin/NotificationBell';
>>>>>>> origin/develop

export interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  href?: string;
}

interface HeaderProps {
  notifications?: HeaderNotification[];
}

<<<<<<< HEAD
/** Sticky admin header: menu/collapse, breadcrumbs, help, the live notification bell and the avatar menu. (Search sits in the bar under it.) */
export const Header: React.FC<HeaderProps> = () => {
=======
/** Sticky admin header: menu/collapse, breadcrumbs and notifications. */
export const Header: React.FC<HeaderProps> = ({ notifications: _notifications = [] }) => {
>>>>>>> origin/develop
  const { pathname } = useLocation();
  const isCustomerDetails = /^\/admin\/customers\/[^/]+/.test(pathname);
  const isCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu);
>>>>>>> origin/develop

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
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <PanelLeftOpen size={20} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={20} aria-hidden="true" />
        )}
      </button>

      <div
        className={`admin-topbar__crumbs${
          isCustomerDetails
            ? ' admin-topbar__crumbs--hide-mobile'
            : ''
        }`}
      >
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
