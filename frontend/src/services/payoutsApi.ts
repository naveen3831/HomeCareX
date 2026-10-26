import api from '@/lib/api';
import type { PayoutItem, PayoutsList } from '../types/payouts';

type Envelope<T> = { data?: T } | T;
const unwrap = <T,>(body: Envelope<T>): T =>
  (body && typeof body === 'object' && 'data' in body && body.data !== undefined ? body.data : body) as T;

/** Real API only: GET /partner/payouts and GET /partner/payouts/:id. */
export const payoutsApi = {
  list: async (): Promise<PayoutsList> => unwrap<PayoutsList>((await api.get('/partner/payouts')).data),
  get: async (id: string): Promise<PayoutItem> =>
    unwrap<PayoutItem>((await api.get(`/partner/payouts/${encodeURIComponent(id)}`)).data),
};