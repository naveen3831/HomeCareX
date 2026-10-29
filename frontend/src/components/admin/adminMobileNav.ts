import {
  CalendarCheck,
  Home,
  LayoutGrid,
  UserCircle,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminNavGroups, type AdminNavItem } from '@/config/adminNav';

export interface AdminTab {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Where the tab goes. Finance picks the first page the admin may open. */
  to: string | ((can: (permission?: string) => boolean) => string | null);
  permission?: string;
  /** Exact match only (Home), otherwise the path or any child path matches. */
  end?: boolean;
  /** Extra path prefixes that keep this tab lit (Categories also covers Services). */
  also?: string[];
}

const FINANCE_PAGES = [
  { path: '/admin/payments', permission: 'payments:read' },
  { path: '/admin/refunds', permission: 'refunds:view' },
  { path: '/admin/payouts', permission: 'payouts:view' },
];

/** The five bottom-bar tabs. Everything else lives on the Profile tab. */
export const ADMIN_TABS: AdminTab[] = [
  { key: 'home', label: 'Home', icon: Home, to: '/admin', end: true },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: CalendarCheck,
    to: '/admin/bookings',
    permission: 'bookings:view',
  },
  {
    key: 'categories',
    label: 'Categories',
    icon: LayoutGrid,
    to: '/admin/categories',
    permission: 'catalog:manage',
    // Services are opened from a category, so they belong to this tab.
    also: ['/admin/services'],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: Wallet,
    to: (can) => FINANCE_PAGES.find((p) => can(p.permission))?.path ?? null,
    also: FINANCE_PAGES.map((p) => p.path),
  },
  { key: 'profile', label: 'Profile', icon: UserCircle, to: '/admin/profile' },
];

/** Paths already reachable from the bottom bar (or Categories), so the Profile menu skips them. */
const HIDDEN_FROM_MENU = new Set([
  '/admin',
  '/admin/bookings',
  '/admin/categories',
  '/admin/services',
  '/admin/payments',
  '/admin/profile',
]);

export type MenuTint = 'indigo' | 'orange' | 'emerald' | 'sky' | 'violet' | 'amber';

export interface AdminMenuGroup {
  heading: string;
  tint: MenuTint;
  items: AdminNavItem[];
}

const GROUP_TINT: Record<string, MenuTint> = {
  Operations: 'indigo',
  Catalog: 'orange',
  Finance: 'emerald',
  Reporting: 'sky',
  Help: 'sky',
  System: 'violet',
  Account: 'amber',
};

/** Sidebar groups for the Profile tab: same pages as the sidebar, minus the bottom-bar ones. */
export function buildAdminMenu(
  can: (permission?: string) => boolean,
): AdminMenuGroup[] {
  const seen = new Set<string>();
  const groups: AdminMenuGroup[] = [];

  for (const group of adminNavGroups) {
    if (group.hiddenInMenu) continue;
    const items = group.items.filter((item) => {
      if (HIDDEN_FROM_MENU.has(item.path) || seen.has(item.path)) return false;
      if (!can(item.permission)) return false;
      seen.add(item.path);
      return true;
    });
    if (items.length === 0) continue;
    groups.push({
      heading: group.groupName,
      tint: GROUP_TINT[group.groupName] ?? 'indigo',
      items,
    });
  }

  return groups;
}

const matches = (pathname: string, base: string, end?: boolean): boolean =>
  end ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);

/** Which tab is lit for a pathname. Pages reached from the Profile menu light Profile. */
export function activeTabKey(
  pathname: string,
  resolved: { key: string; to: string; end?: boolean; also?: string[] }[],
): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const tab of resolved) {
    if (tab.key === 'profile') continue;
    if (
      matches(clean, tab.to, tab.end) ||
      (tab.also ?? []).some((p) => matches(clean, p))
    ) {
      return tab.key;
    }
  }
  return 'profile';
}
