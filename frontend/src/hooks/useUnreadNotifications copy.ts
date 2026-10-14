import { useQuery } from "@tanstack/react-query";
import { notificationKeys, useNotificationSocket } from "@/hooks/useNotifications";
import { fetchNotifications } from "@/services/notificationApi";

/** Unread notification count for the top-bar bell. Real data (one tiny request), refreshed live over the socket. */
export function useUnreadNotifications(): number {
  useNotificationSocket();
  const { data } = useQuery({
    queryKey: notificationKeys.badge,
    queryFn: ({ signal }) => fetchNotifications({ limit: 1 }, signal),
    staleTime: 30_000,
    retry: false,
  });
  return data?.unread ?? 0;
}
