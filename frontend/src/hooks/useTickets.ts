import { useEffect } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSocket } from '@/hooks/useSocket';
import { supportApi } from '@/services/supportApi';
import type { TicketFilters } from '@/features/support/types';

export function useTicketUpdates() {
  const client = useQueryClient();
  const { socket } = useSocket();
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['customer-support'] });
    };
    socket.on('ticket:updated', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('ticket:updated', refresh);
      socket.off('connect', refresh);
    };
  }, [client, socket]);
}
export function useTickets(filters: TicketFilters) {
  const { user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['customer-support', user?.id, 'list', filters],
    queryFn: ({ signal }) => supportApi.list(filters, signal),
    enabled: Boolean(user) && online,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnReconnect: true,
    refetchInterval: online ? 15_000 : false,
  });
}
