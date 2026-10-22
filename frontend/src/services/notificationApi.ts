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
  _id?: string;
  userId: string;
  type: string;
  payload?: unknown;
  readAt?: string | Date | null;
  createdAt: string | Date;
}

interface BackendNotificationsMeta {
  unread?: number;
}

export const emptyGroupCounts = (): NotificationGroupCounts =>
  Object.fromEntries(
    NOTIFICATION_GROUPS.map((group) => [
      group,
      { total: 0, unread: 0 },
    ]),
  ) as NotificationGroupCounts;

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
    group: getGroup(item.type),
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
 * GET /notifications
 * Backend returns an array in data and the global unread count in meta.unread.
 */
export async function fetchNotifications(
  params: FetchNotificationsParams = {},
  signal?: AbortSignal,
): Promise<NotificationsPage> {
  try {
    const { data } = await http.get<
      ApiResponse<BackendNotification[]> & {
        meta?: BackendNotificationsMeta;
      }
    >("/notifications", {
      params: {
        ...(params.limit ? { limit: params.limit } : {}),
      },
      signal,
    });

    const items = (data.data ?? []).map(toCustomerNotification);

    const filteredItems = items.filter((item) => {
      if (params.group && item.group !== params.group) {
        return false;
      }

      if (params.unreadOnly && item.readAt) {
        return false;
      }

      return true;
    });

    return {
      items: filteredItems,
      unread: data.meta?.unread ?? items.filter((item) => !item.readAt).length,
      groups: buildGroupCounts(items),
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * PATCH /notifications/:id/read
 * Backend currently returns { success: true, data: { ok: true } }.
 */
export async function markNotificationRead(
  id: string,
): Promise<CustomerNotification> {
  try {
    await http.patch<ApiResponse<{ ok: boolean }>>(
      `/notifications/${encodeURIComponent(id)}/read`,
    );

    // The backend does not return the updated notification.
    // Return a minimal updated row for React Query's optimistic cache patch.
    return {
      id,
      userId: "",
      type: "system.updated",
      group: "system",
      payload: null,
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * PATCH /notifications/read-all
 */
export async function markAllNotificationsRead(): Promise<number> {
  try {
    await http.patch<ApiResponse<{ ok: boolean }>>(
      "/notifications/read-all",
    );

    return 0;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * The currently supplied backend routes do not implement notification deletion.
 * These functions fail explicitly instead of pretending the delete succeeded.
 */
export async function deleteNotification(_id: string): Promise<void> {
  throw new Error(
    "Deleting a notification is not supported by the current backend API.",
  );
}

export async function deleteAllNotifications(): Promise<number> {
  throw new Error(
    "Deleting notifications is not supported by the current backend API.",
  );
}