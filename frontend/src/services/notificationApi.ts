import http, { type ApiResponse } from "@/lib/http";
import { normalizeApiError } from "@/services/bookingApi";

export const NOTIFICATION_GROUPS = ["booking", "payment", "partner", "offers", "support", "system"] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** Socket.IO event the server emits to the customer's own room for every new notification. */
export const NOTIFICATION_SOCKET_EVENT = "notification:new";

export interface CustomerNotification {
  id: string;
  userId: string;
  /** Machine-readable kind, e.g. "booking.completed". */
  type: string;
  group: NotificationGroup;
  /** Free-form data from the server (bookingId, ticketId, amount, ...). Read it defensively. */
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationGroupCounts = Record<NotificationGroup, { total: number; unread: number }>;

export interface NotificationsPage {
  items: CustomerNotification[];
  /** Unread across ALL groups (not just the filtered list). */
  unread: number;
  groups: NotificationGroupCounts;
}

export interface NotificationQuery {
  group?: NotificationGroup;
  unreadOnly?: boolean;
  limit?: number;
}

export const emptyGroupCounts = (): NotificationGroupCounts =>
  Object.fromEntries(NOTIFICATION_GROUPS.map((g) => [g, { total: 0, unread: 0 }])) as NotificationGroupCounts;

interface ListEnvelope extends ApiResponse<CustomerNotification[]> {
  meta?: { unread?: number; groups?: Partial<NotificationGroupCounts> };
}

/** GET /customer/notifications?group=&unread=true&limit= : the caller's own notifications + per-group unread counts. */
export async function fetchNotifications(query: NotificationQuery = {}, signal?: AbortSignal): Promise<NotificationsPage> {
  try {
    const params: Record<string, string | number> = { limit: query.limit ?? 50 };
    if (query.group) params.group = query.group;
    if (query.unreadOnly) params.unread = "true";
    const { data } = await http.get<ListEnvelope>("/customer/notifications", { params, signal });
    const groups = { ...emptyGroupCounts(), ...(data.meta?.groups ?? {}) } as NotificationGroupCounts;
    return { items: data.data ?? [], unread: data.meta?.unread ?? 0, groups };
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** PATCH /customer/notifications/:id/read (someone else's id is a 404). */
export async function markNotificationRead(id: string): Promise<CustomerNotification> {
  try {
    const { data } = await http.patch<ApiResponse<CustomerNotification>>(`/customer/notifications/${encodeURIComponent(id)}/read`);
    return data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** PATCH /customer/notifications/read-all : returns how many changed. */
export async function markAllNotificationsRead(): Promise<number> {
  try {
    const { data } = await http.patch<ApiResponse<{ updated: number }>>("/customer/notifications/read-all");
    return data.data.updated;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** DELETE /customer/notifications/:id : removes one of the caller's notifications from the database. */
export async function deleteNotification(id: string): Promise<void> {
  try {
    await http.delete(`/customer/notifications/${encodeURIComponent(id)}`);
  } catch (err) {
    throw normalizeApiError(err);
  }
}

/** DELETE /customer/notifications : removes every notification of the caller; returns how many. */
export async function deleteAllNotifications(): Promise<number> {
  try {
    const { data } = await http.delete<ApiResponse<{ deleted: number }>>("/customer/notifications");
    return data.data.deleted;
  } catch (err) {
    throw normalizeApiError(err);
  }
}
