import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { isSos, type AdminNotification } from '@/services/adminNotificationApi';

const TITLES: Record<string, string> = {
  'sos.alert': 'SOS alert',
  'booking.created': 'New booking',
  'booking.cancelled': 'Booking cancelled',
  'ticket.reply': 'New ticket reply',
  'refund.updated': 'Refund updated',
  'payment.failed': 'Payment failed',
};
const title = (n: AdminNotification) => TITLES[n.type] ?? n.type.replace(/[._]/g, ' ');

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

function target(n: AdminNotification): string {
  const p = n.payload ?? {};
  if (typeof p.bookingId === 'string' && p.bookingId && !p.bookingId.startsWith('demo')) return '/admin/bookings';
  if (typeof p.ticketId === 'string') return '/admin/support';
  return '/admin/notifications';
}

/** Admin bell: unread badge, recent list, mark read / all, live via socket. SOS rows are red and listed first. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { items, unread, error, refresh, read, readAll } = useAdminNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const hasUnreadSos = items.some((n) => isSos(n) && !n.readAt);
  // Unread SOS first, otherwise newest first.
  const ordered = [...items].sort((a, b) => Number(isSos(b) && !b.readAt) - Number(isSos(a) && !a.readAt));

  return (
    <div className="popover" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="icon-btn hcx-bell"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && <span className={`hcx-bell__count${hasUnreadSos ? ' hcx-bell__count--sos' : ''}`}>{unread > 9 ? '9+' : unread}</span>}
      </button>

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
                      navigate(target(n));
                    }}
                  >
                    <span>
                      {isSos(n) && <AlertTriangle size={14} aria-hidden="true" />} {title(n)}
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
