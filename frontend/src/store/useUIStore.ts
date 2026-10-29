import { create } from 'zustand';

interface UIState {
  pageSearch: string;
  setPageSearch: (value: string) => void;

  // Active bookings count for customer TopBar
  activeBookingsCount: number | null;
  setActiveBookingsCount: (count: number | null) => void;

  // Desktop: true = full sidebar with labels, false = icon-only strip
  isSidebarCollapsed: boolean;
  // Mobile: true = the sidebar drawer is slid open over the page
  isMobileMenuOpen: boolean;
  theme: 'light' | 'dark';

  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  pageSearch: '',
  setPageSearch: (value) => set({ pageSearch: value }),
  activeBookingsCount: null,
  setActiveBookingsCount: (count) => set({ activeBookingsCount: count }),
  isSidebarCollapsed: false,
  isMobileMenuOpen: false,
  theme: 'light',

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
}));
