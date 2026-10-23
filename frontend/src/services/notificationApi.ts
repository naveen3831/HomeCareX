import http, { type ApiResponse } from "@/lib/http";
import { normalizeApiError } from "@/services/bookingApi";

export const NOTIFICATION_GROUPS = [
  "booking",
  "payment",
  "partner",
  "offers",
  "support",
  "system",
] as const;

export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export const NOTIFICATION_SOCKET_EVENT = "notification:new";

export interface CustomerNotification {
  id: string;
  userId: string;
  type: string;
  group: NotificationGroup;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationGroupCounts = Record<
  NotificationGroup,
  { total: number; unread: number }
>;

export interface NotificationsPage {
  items: CustomerNotification[];
  unread: number;
  groups: NotificationGroupCounts;
}

export interface FetchNotificationsParams {
  group?: NotificationGroup;
  unreadOnly?: boolean;
  limit?: number;
}

/** Alias so tests and callers can use either name. */
export type NotificationQuery = FetchNotificationsParams;

interface BackendNotification {
  id?: string;
  group?: string;
  _id?: string;
  userId: string;
  type: string;
  payload?: unknown;
  readAt?: string | Date | null;
  createdAt: string | Date;
}

interface BackendNotificationsMeta {
  unread?: number;
  groups?: Partial<NotificationGroupCounts>;
}

export const emptyGroupCounts = (): NotificationGroupCounts =>
  Object.fromEntries(
    NOTIFICATION_GROUPS.map((group) => [
      group,
      { total: 0, unread: 0 },
    ]),
  ) as NotificationGroupCounts;

const isGroup = (g: unknown): g is NotificationGroup =>
  typeof g === "string" && (NOTIFICATION_GROUPS as readonly string[]).includes(g);

function getGroup(type: string): NotificationGroup {
  const prefix = type.split(".")[0];

  switch (prefix) {
    case "booking":
      return "booking";
    case "payment":
    case "payout":
    case "refund":
      return "payment";
    case "partner":
      return "partner";
    case "offer":
      return "offers";
    case "ticket":
    case "support":
      return "support";
    default:
      return "system";
  }
}

function toCustomerNotification(
  item: BackendNotification,
): CustomerNotification {
  const id = item.id ?? item._id;

  if (!id) {
    throw new Error("Notification response is missing its ID.");
  }

  const payload =
    item.payload &&
    typeof item.payload === "object" &&
    !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : null;

  return {
    id,
    userId: String(item.userId),
    type: item.type,
    group: isGroup(item.group) ? item.group : getGroup(item.type),
    payload,
    readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
    createdAt: new Date(item.createdAt).toISOString(),
  };
}

function buildGroupCounts(
  items: CustomerNotification[],
): NotificationGroupCounts {
  const groups = emptyGroupCounts();

  for (const item of items) {
    groups[item.group].total += 1;

    if (!item.readAt) {
      groups[item.group].unread += 1;
    }
  }

  return groups;
}

/**
 * GET /customer/notifications?group=&unread=&limit=
 * data = the page of notifications, meta = { unread, groups } where both counts cover ALL of the
 * customer's notifications (not just this page / filter).
 */
export async function fetchNotifications(
  params: FetchNotificationsParams = {},
  signal?: AbortSignal,
): Promise<NotificationsPage> {
  try {
    const { data } = await http.get<
      ApiResponse<BackendNotification[]> & { meta?: BackendNotificationsMeta }
    >("/customer/notifications", {
      params: {
        ...(params.group ? { group: params.group } : {}),
        ...(params.unreadOnly ? { unread: "true" } : {}),
        // The API accepts 1-100.
        ...(params.limit ? { limit: Math.min(100, Math.max(1, params.limit)) } : {}),
      },
      signal,
    });

    const items = (data.data ?? []).map(toCustomerNotification);

    // Prefer the server's counts: they are not limited by the page size or the active filter.
    const groups = emptyGroupCounts();
    const serverGroups = data.meta?.groups;
    if (serverGroups) {
      for (const g of NOTIFICATION_GROUPS) {
        groups[g] = { total: serverGroups[g]?.total ?? 0, unread: serverGroups[g]?.unread ?? 0 };
      }
    } else {
      Object.assign(groups, buildGroupCounts(items));
    }

    return {
      items,
      unread: data.meta?.unread ?? NOTIFICATION_GROUPS.reduce((n, g) => n + groups[g].unread, 0),
      groups,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** PATCH /customer/notifications/:id/read. Returns the updated notification. */
export async function markNotificationRead(id: string): Promise<CustomerNotification> {
  try {
    const { data } = await http.patch<ApiResponse<BackendNotification>>(
      `/customer/notifications/${encodeURIComponent(id)}/read`,
    );
    return toCustomerNotification(data.data);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** PATCH /customer/notifications/read-all. Returns how many were changed. */
export async function markAllNotificationsRead(): Promise<number> {
  try {
    const { data } = await http.patch<ApiResponse<{ updated: number }>>(
      "/customer/notifications/read-all",
    );
    return data.data?.updated ?? 0;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** DELETE /customer/notifications/:id. A missing or someone else's id is a 404. */
export async function deleteNotification(id: string): Promise<void> {
  try {
    await http.delete(`/customer/notifications/${encodeURIComponent(id)}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** DELETE /customer/notifications. Clears all of the signed-in customer's notifications; returns how many. */
export async function deleteAllNotifications(): Promise<number> {
  try {
    const { data } = await http.delete<ApiResponse<{ deleted: number }>>("/customer/notifications");
    return data.data?.deleted ?? 0;
  } catch (error) {
    throw normalizeApiError(error);
  }
}