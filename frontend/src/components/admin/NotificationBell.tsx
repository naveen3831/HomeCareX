import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { isSos, type AdminNotification } from '@/services/adminNotificationApi';
import { notificationMeta, notificationTarget } from '@/lib/adminNotificationMeta';

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

/** Unread SOS first, otherwise newest first (the server already sends newest first; sort is stable). */
const withSosFirst = (items: AdminNotification[]) =>
  [...items].sort((a, b) => Number(isSos(b) && !b.readAt) - Number(isSos(a) && !a.readAt));

/**
 * Admin bell: unread badge, recent list, mark one / all read, live via the `notification:new` socket event.
 * Clicking a row marks it read and opens its page (see notificationTarget). Unread SOS turns the badge red,
 * lists first, and is announced to screen readers straight away.
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { items, unread, error, refresh, read, readAll } = useAdminNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const unreadSos = items.filter((n) => isSos(n) && !n.readAt);
  const hasUnreadSos = unreadSos.length > 0;
  const ordered = withSosFirst(items);

  return (
    <div className="popover" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="icon-btn hcx-bell"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}${hasUnreadSos ? ', SOS alert' : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className={`hcx-bell__count${hasUnreadSos ? ' hcx-bell__count--sos' : ''}`} data-testid="bell-count">
            {unread}
          </span>
        )}
      </button>

      {/* Announced the moment an SOS arrives, even with the panel closed. */}
      <p role="alert" className="sr-only">
        {hasUnreadSos ? `SOS alert: ${String(unreadSos[0].payload?.message ?? 'a partner needs help')}` : ''}
      </p>

      {open && (
        <div className="popover__panel hcx-notif-panel hcx-notif-panel--wide">
          <div className="hcx-notif-panel__head">
            <strong>Notifications</strong>
            <button type="button" onClick={() => void readAll()} disabled={unread === 0}>Mark all read</button>
          </div>
          {error && ordered.length === 0 ? (
            <p className="hcx-notif-panel__empty" role="alert">
              Couldn&apos;t load notifications. <button type="button" onClick={() => void refresh()}>Retry</button>
            </p>
          ) : ordered.length === 0 ? (
            <p className="hcx-notif-panel__empty">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {ordered.map((n) => (
                <li key={n.id} className={`${n.readAt ? '' : 'is-unread'}${isSos(n) ? ' is-sos' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      void read(n.id);
                      setOpen(false);
                      navigate(notificationTarget(n));
                    }}
                  >
                    <span>
                      {isSos(n) && <AlertTriangle size={14} aria-hidden="true" />} {notificationMeta(n.type).title}
                    </span>
                    {typeof n.payload?.message === 'string' && <em>{n.payload.message}</em>}
                    <small>{ago(n.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/notifications" className="hcx-notif-panel__all" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
