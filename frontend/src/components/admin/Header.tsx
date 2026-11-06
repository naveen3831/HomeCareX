import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { useUIStore } from '@/store/useUIStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  href?: string;
}

interface HeaderProps {
  notifications?: HeaderNotification[];
}

/** Sticky admin header: sidebar open/close button (desktop) and the notification bell. */
export const Header: React.FC<HeaderProps> = ({ notifications = [] }) => {
  // Notifications are rendered by NotificationBell; keep the prop for existing callers.
  void notifications;

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const closed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header className="admin-topbar" style={{ justifyContent: 'flex-end' }}>
      {isDesktop && (
        <button
          type="button"
          className="icon-btn"
          style={{ marginRight: 'auto' }}
          onClick={toggleSidebar}
          aria-label={closed ? 'Open sidebar' : 'Close sidebar'}
          aria-expanded={!closed}
          title={closed ? 'Open sidebar' : 'Close sidebar'}
        >
          {closed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>
      )}
      <div className="topbar-right">
        <NotificationBell />
      </div>
    </header>
  );
};

export default Header;
