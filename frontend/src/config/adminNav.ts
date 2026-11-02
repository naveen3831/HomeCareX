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
  ClipboardList,
  Lock,
  UserCog,
  UserPlus,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  RotateCcw,
  Settings,
  Star,
  ShieldCheck,
  Tag,
  Ticket,
  UserCircle,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Optional permission key. When set, PermissionGate / RequirePermission use it. */
  permission?: string;
  /** Extra paths that keep this item highlighted in the sidebar (Help stays lit on Leads). */
  also?: string[];
}

export interface AdminNavGroup {
  groupName: string;
  items: AdminNavItem[];
  /** `hidden` groups are not drawn in the sidebar but still feed breadcrumbs + search. */
  hidden?: boolean;
  /** Left out of the phone Profile menu too. */
  hiddenInMenu?: boolean;
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    groupName: 'Overview',
    items: [{ label: 'Dashboard', path: '/admin', icon: LayoutDashboard }],
  },
  {
    groupName: 'Operations',
    items: [
      { label: 'Bookings', path: '/admin/bookings', icon: CalendarCheck, permission: 'bookings:view' },
      { label: 'Customers', path: '/admin/customers', icon: Users, permission: 'customers:view' },
      { label: 'Manage Partners', path: '/admin/manage-partners', icon: UserPlus, permission: 'partners:view' },
      { label: 'Partners & KYC', path: '/admin/partners', icon: HardHat, permission: 'partners:view' },
      { label: 'Reviews', path: '/admin/reviews', icon: Star, permission: 'reviews:view' },
    ],
  },
  {
    groupName: 'Catalog',
    items: [
      { label: 'Categories', path: '/admin/categories', icon: LayoutGrid, permission: 'catalog:manage' },
      { label: 'Services', path: '/admin/services', icon: Wrench, permission: 'catalog:manage' },
      { label: 'Pricing', path: '/admin/pricing', icon: Tag, permission: 'pricing:view' },
      { label: 'Coupons', path: '/admin/coupons', icon: Ticket, permission: 'coupons:view' },
      { label: 'Marketing', path: '/admin/marketing', icon: Megaphone, permission: 'marketing:view' },
    ],
  },
  {
    groupName: 'Finance',
    items: [
      { label: 'Payments', path: '/admin/payments', icon: CreditCard, permission: 'payments:read' },
      { label: 'Refunds', path: '/admin/refunds', icon: RotateCcw, permission: 'refunds:view' },
      { label: 'Payouts', path: '/admin/payouts', icon: Wallet, permission: 'payouts:view' },
    ],
  },
  {
    groupName: 'Reporting',
    items: [{ label: 'Reports', path: '/admin/reports', icon: BarChart3, permission: 'reports:view' }],
  },
  {
    // Collapsible like the other groups; Leads is reached from the Support / Leads tabs on those pages.
    groupName: 'Help',
    items: [
      {
        label: 'Support',
        path: '/admin/support',
        icon: Headset,
        permission: 'tickets:view',
        also: ['/admin/leads'],
      },
    ],
  },
  {
    // Not in the sidebar, but still found by search. Same group name, so Help opens when you are on Leads.
    groupName: 'Help',
    hidden: true,
    hiddenInMenu: true,
    items: [{ label: 'Leads', path: '/admin/leads', icon: ClipboardList, permission: 'leads:view' }],
  },
  {
    groupName: 'System',
    items: [
      { label: 'Roles', path: '/admin/roles', icon: ShieldCheck, permission: 'roles:view' },
      { label: 'Staff', path: '/admin/staff', icon: UserCog, permission: 'staff:view' },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileClock, permission: 'audit:view' },
      { label: 'Account Security', path: '/admin/security', icon: Lock },
      { label: 'Settings', path: '/admin/settings', icon: Settings, permission: 'settings:manage' },
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