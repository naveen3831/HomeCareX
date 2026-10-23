import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '@/services/bookingSocket';
import {
  fetchRecent,
  markAllRead,
  markRead,
  NOTIFICATION_SOCKET_EVENT,
  type AdminNotification,
} from '@/services/adminNotificationApi';

/** Recent admin notifications + unread count, kept live by the `notification:new` socket event. */
export function useAdminNotifications(limit = 10) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchRecent(limit);
      setItems(r.items);
      setUnread(r.unread);
      setError(false);
    } catch {
      setError(true); // keep what we have; the poll, focus or reconnect refreshes
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
    const socket = getSocket();
    // A pushed row is added at once; a refetch (also on reconnect) keeps the count exact.
    const onNew = (n: AdminNotification) => {
      setItems((cur) => (cur.some((x) => x.id === n.id) ? cur : [n, ...cur].slice(0, limit)));
      setUnread((u) => u + 1);
      void refresh();
    };
    socket.on(NOTIFICATION_SOCKET_EVENT, onNew);
    socket.on('connect', refresh);
    // A server-side handshake rejection (token not ready yet) is not retried by socket.io: retry it ourselves.
    const onConnectError = () => { window.setTimeout(() => { if (!socket.connected) socket.connect(); }, 5_000); };
    socket.on('connect_error', onConnectError);
    // Safety net when the socket is down: poll, and refresh when the tab regains focus.
    const poll = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off(NOTIFICATION_SOCKET_EVENT, onNew);
      socket.off('connect', refresh);
      socket.off('connect_error', onConnectError);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, limit]);

  const read = useCallback(async (id: string) => {
    setItems((cur) => cur.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await markRead(id); } catch { void refresh(); }
  }, [refresh]);

  const readAll = useCallback(async () => {
    setItems((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try { await markAllRead(); } catch { void refresh(); }
  }, [refresh]);

  return { items, unread, loading, error, refresh, read, readAll };
}
