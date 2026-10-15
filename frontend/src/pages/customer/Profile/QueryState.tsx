import { ErrorState, LoadingState, OfflineState } from "@/components/customer/StateViews";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Loading / offline / error view for one request, so a settings page is never blank while its data loads. */
export default function QueryState({ q, label }: { q: { isPending: boolean; isError: boolean; refetch: () => unknown }; label: string }) {
  const online = useOnlineStatus();
  // Offline with nothing cached: React Query pauses the request (isPending stays true), so say "offline" instead of loading forever.
  if (!online && (q.isPending || q.isError)) return <OfflineState onRetry={() => void q.refetch()} />;
  if (q.isPending) return <LoadingState label={`Loading your ${label}…`} />;
  if (q.isError) return <ErrorState title={`Couldn't load your ${label}`} onRetry={() => void q.refetch()} />;
  return null;
}
