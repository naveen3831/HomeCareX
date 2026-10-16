import { SESSION_EXPIRED_EVENT } from '@/lib/tokenStore';

export { SESSION_EXPIRED_EVENT };

export const emitSessionExpired = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
};
