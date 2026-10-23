import http, { type ApiResponse } from '@/lib/http';

export interface AdminNotification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATION_SOCKET_EVENT = 'notification:new';
/** Types that must stand out in the bell (matches the backend HIGH_PRIORITY_TYPES). */
export const isSos = (n: Pick<AdminNotification, 'type'>) => n.type === 'sos.alert';

/** GET /notifications : the signed-in admin's own notifications, newest first, plus the unread count. */
export async function fetchRecent(limit = 10): Promise<{ items: AdminNotification[]; unread: number }> {
  const { data } = await http.get<ApiResponse<AdminNotification[]> & { meta?: { unread?: number } }>('/notifications', { params: { limit } });
  return { items: data.data ?? [], unread: data.meta?.unread ?? 0 };
}
/** PATCH /notifications/:id/read */
export const markRead = (id: string) => http.patch(`/notifications/${encodeURIComponent(id)}/read`);
/** PATCH /notifications/read-all */
export const markAllRead = () => http.patch('/notifications/read-all');
