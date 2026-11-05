import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUIStore } from '@/store/useUIStore';

export const ADMIN_SIDEBAR_WIDTH = 260;

/**
 * Left offset (px) that full-page admin panels must keep free for the sidebar.
 * Desktop: 260 when the sidebar is open, 0 when it is closed. Phones: always 0.
 */
export function useSidebarOffset(): number {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const closed = useUIStore((state) => state.isSidebarCollapsed);
  return isDesktop && !closed ? ADMIN_SIDEBAR_WIDTH : 0;
}
