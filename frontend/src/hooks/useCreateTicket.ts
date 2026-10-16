import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/services/supportApi';
import type { NewTicket } from '@/features/support/types';

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, files }: { input: NewTicket; files: File[] }) =>
      supportApi.create(input, files),
    retry: false,
    networkMode: 'always',
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customer-support'] });
    },
  });
}
