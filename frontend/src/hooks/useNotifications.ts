import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSocket } from "@/services/bookingSocket";
import type { NormalizedApiError } from "@/services/bookingApi";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type CustomerNotification,
  type NotificationGroup,
  type NotificationsPage,
} from "@/services/notificationApi";

export interface NotificationFilters {
  group?: NotificationGroup;
  unreadOnly?: boolean;
}

export const NOTIFICATIONS_LIMIT = 50;

/** Every notifications query lives under this prefix, so one invalidate refreshes the list and the bell. */
export const notificationKeys = {
  all: ["customer-notifications"] as const,
  list: (filters: NotificationFilters) => ["customer-notifications", "list", filters] as const,
  badge: ["customer-notifications", "badge"] as const,
};

const retryReads = (failureCount: number, error: NormalizedApiError): boolean =>
  failureCount < 2 && (error.status === 0 || error.status >= 500);

/**
 * Live updates: the server pushes `notification:new` to the signed-in customer's own socket room.
 * We refetch instead of trusting the pushed row, so counts and filters always match the server.
 */
export function useNotificationSocket(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const onNew = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    socket.on(NOTIFICATION_SOCKET_EVENT, onNew);
    // A reconnect may have missed pushes while offline.
    socket.on("connect", onNew);
    return () => {
      socket.off(NOTIFICATION_SOCKET_EVENT, onNew);
      socket.off("connect", onNew);
    };
  }, [queryClient]);
}

/** The notifications list for a group / unread filter, kept live by the socket. */
export function useNotifications(filters: NotificationFilters) {
  useNotificationSocket();
  const normalized: NotificationFilters = {
    ...(filters.group ? { group: filters.group } : {}),
    ...(filters.unreadOnly ? { unreadOnly: true } : {}),
  };
  return useQuery<NotificationsPage, NormalizedApiError>({
    queryKey: notificationKeys.list(normalized),
    queryFn: ({ signal }) => fetchNotifications({ ...normalized, limit: NOTIFICATIONS_LIMIT }, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: retryReads,
  });
}

/** Applies a change to every cached notifications page (lists and the bell). */
function patchCachedPages(queryClient: QueryClient, patch: (page: NotificationsPage) => NotificationsPage): void {
  queryClient.setQueriesData<NotificationsPage>({ queryKey: notificationKeys.all }, (old) => (old && Array.isArray(old.items) ? patch(old) : old));
}

/** PATCH /customer/notifications/:id/read. The row shows as read at once; counts are then refetched. */

/** PATCH /notifications/:id/read. Update only the matching row, then refetch server data. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<CustomerNotification, NormalizedApiError, string>({
    mutationFn: async (id) => {
      await markNotificationRead(id);

      const cachedPages = queryClient.getQueriesData<NotificationsPage>({
        queryKey: notificationKeys.all,
      });

      const existing = cachedPages
        .map(([, page]) => page?.items.find((item) => item.id === id))
        .find((item) => item !== undefined);

      if (!existing) {
        throw new Error("Notification not found in the current cache.");
      }

      return {
        ...existing,
        readAt: existing.readAt ?? new Date().toISOString(),
      };
    },

    onSuccess: (updated) => {
      patchCachedPages(queryClient, (page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));

      void queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });
    },

    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });
    },
  });
}


/** PATCH /customer/notifications/read-all. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<number, NormalizedApiError, void>({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      const now = new Date().toISOString();
      patchCachedPages(queryClient, (page) => ({
        unread: 0,
        items: page.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
        groups: Object.fromEntries(NOTIFICATION_GROUPS.map((g) => [g, { ...page.groups[g], unread: 0 }])) as NotificationsPage["groups"],
      }));
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** DELETE /customer/notifications/:id. The row disappears at once (counts adjusted); a failure restores it from the server. */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation<void, NormalizedApiError, CustomerNotification>({
    mutationFn: (n) => deleteNotification(n.id),
    onMutate: (n) => {
      patchCachedPages(queryClient, (page) => {
        const groups = { ...page.groups, [n.group]: { total: Math.max(0, page.groups[n.group].total - 1), unread: Math.max(0, page.groups[n.group].unread - (n.readAt ? 0 : 1)) } };
        return { unread: Math.max(0, page.unread - (n.readAt ? 0 : 1)), items: page.items.filter((x) => x.id !== n.id), groups };
      });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** DELETE /customer/notifications: clears every notification of the signed-in customer. */
export function useDeleteAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation<number, NormalizedApiError, void>({
    mutationFn: () => deleteAllNotifications(),
    onSuccess: () => {
      patchCachedPages(queryClient, () => ({
        unread: 0,
        items: [],
        groups: Object.fromEntries(NOTIFICATION_GROUPS.map((g) => [g, { total: 0, unread: 0 }])) as NotificationsPage["groups"],
      }));
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
