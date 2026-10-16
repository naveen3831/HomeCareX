import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { supportApi } from '@/services/supportApi';

export function useTicket(id: string) {
  const { user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['customer-support', user?.id, 'ticket', id],
    queryFn: ({ signal }) => supportApi.get(id, signal),
    enabled: Boolean(id && user) && online,
    retry: false,
    refetchInterval: online ? 5000 : false,
    refetchOnReconnect: true,
  });
}
