// The single place that lists every admin page.
// Add a page here once and it shows up in the sidebar, the header search
// and the breadcrumbs automatically.

import {
  BarChart3,
  Bell,
  CalendarCheck,
  CreditCard,
  FileClock,
  HardHat,
  Headset,
  Inbox,
  UserPlus,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Megaphone,
  RotateCcw,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Ticket,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Optional permission key (or several: any one is enough). Used by the sidebar and route guards. */
  permission?: string | string[];
}

export interface AdminNavGroup {
  groupName: string;
  items: AdminNavItem[];
  /** `hidden` groups are not drawn in the sidebar but still feed breadcrumbs + search. */
  hidden?: boolean;
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    groupName: 'Overview',
    items: [{ label: 'Dashboard', path: '/admin', icon: LayoutDashboard }],
  },
  {
    groupName: 'Operations',
    items: [
      { label: 'Inbox', path: '/admin/leads', icon: Inbox, permission: 'leads:view' },
      { label: 'Bookings', path: '/admin/bookings', icon: CalendarCheck, permission: 'bookings:view' },
      { label: 'Customers', path: '/admin/customers', icon: Users, permission: 'customers:view' },
      { label: 'Manage Partners', path: '/admin/manage-partners', icon: UserPlus, permission: 'partners:view' },
      { label: 'Partners & KYC', path: '/admin/partners', icon: HardHat, permission: 'partners:view' },
      { label: 'Support', path: '/admin/support', icon: Headset, permission: 'tickets:view' },
    ],
  },
  {
    groupName: 'Catalog',
    items: [
      { label: 'Categories', path: '/admin/categories', icon: LayoutGrid, permission: 'catalog:view' },
      { label: 'Services', path: '/admin/services', icon: Wrench, permission: 'catalog:view' },
      { label: 'Pricing', path: '/admin/pricing', icon: Tag, permission: 'pricing:view' },
      { label: 'Coupons', path: '/admin/coupons', icon: Ticket, permission: 'coupons:view' },
      { label: 'Marketing', path: '/admin/marketing', icon: Megaphone, permission: 'marketing:view' },
    ],
  },
  {
    groupName: 'Finance',
    items: [
      { label: 'Payments', path: '/admin/payments', icon: CreditCard, permission: 'payments:view' },
      { label: 'Refunds', path: '/admin/refunds', icon: RotateCcw, permission: 'refunds:view' },
      { label: 'Payouts', path: '/admin/payouts', icon: Wallet, permission: 'payouts:view' },
    ],
  },
  {
    groupName: 'Quality',
    items: [{ label: 'Reviews', path: '/admin/reviews', icon: Star, permission: 'reviews:view' }],
  },
  {
    groupName: 'Reporting',
    items: [{ label: 'Reports', path: '/admin/reports', icon: BarChart3, permission: 'reports:view' }],
  },
  {
    groupName: 'System',
    items: [
      { label: 'Roles', path: '/admin/roles-permissions', icon: ShieldCheck },
      { label: 'Staff', path: '/admin/staff', icon: UserCog },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileClock },
      { label: 'Security', path: '/admin/security', icon: Lock },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
    ],
  },
  {
    // Reachable from the header only.
    groupName: 'Account',
    hidden: true,
    items: [
      { label: 'My Profile', path: '/admin/profile', icon: UserCircle },
      { label: 'Account Security', path: '/admin/security', icon: Lock },
      { label: 'Notifications', path: '/admin/notifications', icon: Bell },
    ],
  },
];

export interface AdminPage extends AdminNavItem {
  groupName: string;
}

/** Flat list of every page, used by search + breadcrumbs. */
export const allAdminPages: AdminPage[] = adminNavGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupName: group.groupName })),
);

/**
 * Finds the page for a pathname. Exact match first, then the longest page path
 * that is a prefix (so /admin/bookings/BK-1 resolves to Bookings).
 */
export function findAdminPage(pathname: string): AdminPage | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const exact = allAdminPages.find((page) => page.path === clean);
  if (exact) return exact;
  return allAdminPages
    .filter((page) => page.path !== '/admin' && clean.startsWith(`${page.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}