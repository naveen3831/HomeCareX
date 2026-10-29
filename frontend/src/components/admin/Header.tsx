import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { NotificationBell } from '@/components/admin/NotificationBell';

export interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  href?: string;
}

export interface HeaderProps {
  notifications?: HeaderNotification[];
}

/** Sticky admin header with navigation, breadcrumbs, help, notifications, and the profile menu. */
export const Header: React.FC<HeaderProps> = ({ notifications = [] }) => {
  const isCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  // Notifications are rendered by NotificationBell; keep the prop for existing callers.
  void notifications;

  return (
    <header className="admin-topbar">
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