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

interface HeaderProps {
  notifications?: HeaderNotification[];
}

/**
 * Sticky admin header: sidebar collapse (desktop) and the live notification bell.
 * No breadcrumbs and no help link (Help > Support lives in the sidebar).
 * No avatar and no hamburger: on phones the bottom bar + Profile tab replace the drawer, and on desktop the
 * sidebar footer links to the profile. (Search sits in the bar under it.)
 */
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
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <PanelLeftOpen size={20} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={20} aria-hidden="true" />
        )}
      </button>

      <div className="topbar-right">
        <NotificationBell />
      </div>
    </header>
  );
};

export default Header;
