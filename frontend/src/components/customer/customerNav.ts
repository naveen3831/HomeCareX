import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  FileText,
  Gift,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Lock,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Ticket,
  User,
  Wallet,
  Wrench,
} from "lucide-react";
import { customerPath } from "@/routes/customerPath";

export interface CustomerNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match the exact path only (so a parent link isn't active on its children). */
  end?: boolean;
}

export interface CustomerNavGroup {
  heading: string;
  items: CustomerNavItem[];
}

/** Desktop sidebar — single source of truth for grouped navigation. */
export const SIDEBAR_GROUPS: CustomerNavGroup[] = [
  {
    heading: "Home",
    items: [
      { label: "Overview", to: customerPath(), icon: LayoutDashboard, end: true },
      { label: "Categories", to: customerPath("/categories"), icon: LayoutGrid },
      { label: "Services", to: customerPath("/services"), icon: Wrench },
    ],
  },
  {
    heading: "Bookings",
    items: [
      { label: "My Bookings", to: customerPath("/bookings"), icon: CalendarCheck },
      { label: "Active Booking", to: customerPath("/tracking"), icon: Navigation },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Addresses", to: customerPath("/addresses"), icon: MapPin },
      { label: "Profile", to: customerPath("/profile"), icon: User },
      { label: "Account Security", to: customerPath("/security"), icon: ShieldCheck },
      { label: "Payments", to: customerPath("/payments"), icon: CreditCard },
      { label: "Wallet", to: customerPath("/wallet"), icon: Wallet },
      { label: "Reviews", to: customerPath("/reviews"), icon: Star },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "Help Center", to: customerPath("/support"), icon: LifeBuoy, end: true },
      { label: "My Tickets", to: customerPath("/support/tickets"), icon: Ticket },
      { label: "Referrals", to: customerPath("/referrals"), icon: Gift },
    ],
  },
];

/** Mobile bottom navigation — five tabs: Categories / Services / Home (centred) / My Bookings / Profile.
 *  A tab is highlighted ONLY on its own page (exact match): the pages reached from a tab (service details,
 *  the booking flow, booking details, Addresses, Wallet, Support…) light no tab at all.
 *  Everything else (Account, Support, Referrals…) lives on the Profile tab: see PROFILE_MENU_GROUPS. */
export const BOTTOM_NAV_ITEMS: CustomerNavItem[] = [
  { label: "Categories", to: customerPath("/categories"), icon: LayoutGrid, end: true },
  { label: "Services", to: customerPath("/services"), icon: Wrench, end: true },
  { label: "Home", to: customerPath(), icon: Home, end: true },
  { label: "My Bookings", to: customerPath("/bookings"), icon: CalendarCheck, end: true },
  { label: "Profile", to: customerPath("/profile"), icon: User, end: true },
];

/* ------------------------------------------------------------------ */
/* Profile menu (mobile): the sidebar minus what the bottom nav covers */
/* ------------------------------------------------------------------ */

/** Pages the bottom nav already reaches (or that are the Profile page itself). */
const NOT_IN_PROFILE_MENU = new Set([customerPath(), customerPath("/categories"), customerPath("/services"), customerPath("/profile")]);

/** Settings pages shown on the desktop Profile cards but absent from the sidebar, keyed by the sidebar link they follow. */
const PROFILE_EXTRA_AFTER: Record<string, CustomerNavItem[]> = {
  [customerPath("/security")]: [
    { label: "Change password", to: customerPath("/profile/password"), icon: Lock },
    { label: "Notifications", to: customerPath("/profile/notifications"), icon: Bell },
  ],
};

/**
 * Mobile replacement for the hamburger drawer. Derived from SIDEBAR_GROUPS, so a link added to the
 * desktop sidebar automatically shows up in the Profile menu too — minus Dashboard, Categories,
 * Services (bottom nav) and Profile (you're on it).
 */
export const PROFILE_MENU_GROUPS: CustomerNavGroup[] = [
  ...SIDEBAR_GROUPS.map((g) => ({
    heading: g.heading,
    // Insert the settings pages that exist on the desktop Profile cards but not in the sidebar.
    items: g.items
      .filter((i) => !NOT_IN_PROFILE_MENU.has(i.to))
      .flatMap((i) => [i, ...(PROFILE_EXTRA_AFTER[i.to] ?? [])]),
  })).filter((g) => g.items.length > 0),
  {
    heading: "Legal",
    items: [
      { label: "Terms & Conditions", to: customerPath("/profile/terms"), icon: FileText },
      { label: "Privacy Policy", to: customerPath("/profile/privacy"), icon: ShieldCheck },
    ],
  },
];

export type ProfileTint = "indigo" | "orange" | "emerald" | "amber" | "sky" | "rose" | "violet";

/** Subtitle + icon colour for a Profile menu row, keyed by the nav label. Unknown labels get a neutral default. */
export const PROFILE_ITEM_META: Record<string, { description: string; tint: ProfileTint }> = {
  "My Bookings": { description: "Upcoming, completed & cancelled", tint: "indigo" },
  "Active Booking": { description: "Track your partner live", tint: "orange" },
  Addresses: { description: "Where we should come", tint: "sky" },
  "Account Security": { description: "Password, sessions & devices", tint: "violet" },
  Payments: { description: "Payment methods & receipts", tint: "emerald" },
  Wallet: { description: "Balance & cashback", tint: "amber" },
  Reviews: { description: "Your ratings & feedback", tint: "rose" },
  "Help Center": { description: "FAQs & contact support", tint: "sky" },
  "My Tickets": { description: "Your support requests", tint: "indigo" },
  Referrals: { description: "Invite friends, earn rewards", tint: "violet" },
  "Change password": { description: "Keep your account secure", tint: "orange" },
  Notifications: { description: "Choose alerts & your language", tint: "rose" },
  "Terms & Conditions": { description: "Read the rules for using HomeCareX", tint: "indigo" },
  "Privacy Policy": { description: "How we handle your data", tint: "emerald" },
};