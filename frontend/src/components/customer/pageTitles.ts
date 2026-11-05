import { customerPath } from "@/routes/customerPath";

export interface CustomerPageMeta {
  /** Shown next to the back arrow in the phone top bar. */
  title: string;
  /** Where the back arrow goes when there is no in-app history to return to (deep link, refresh). */
  parent: string;
}

const HOME = customerPath();
const PROFILE = customerPath("/profile");
const BOOKINGS = customerPath("/bookings");
const SERVICES = customerPath("/services");
const SUPPORT = customerPath("/support");

/** First match wins, so more specific paths come before their parents. Paths are relative to /customer. */
const PAGES: Array<[RegExp, CustomerPageMeta]> = [
  [/^\/categories$/, { title: "Categories", parent: HOME }],
  [/^\/services$/, { title: "Services", parent: HOME }],
  [/^\/services\/[^/]+$/, { title: "Service details", parent: SERVICES }],
  [/^\/book\/[^/]+$/, { title: "Book Service", parent: SERVICES }],
  [/^\/bookings$/, { title: "My Bookings", parent: HOME }],
  [/^\/bookings\/[^/]+\/track$/, { title: "Track booking", parent: BOOKINGS }],
  [/^\/bookings\/[^/]+$/, { title: "Booking details", parent: BOOKINGS }],
  [/^\/tracking$/, { title: "Active Bookings", parent: PROFILE }],
  [/^\/booking\/success\/[^/]+$/, { title: "Booking confirmed", parent: BOOKINGS }],
  [/^\/booking\/booked\/[^/]+$/, { title: "Booking confirmed", parent: BOOKINGS }],
  [/^\/booking\/failed\/[^/]+$/, { title: "Payment failed", parent: BOOKINGS }],
  [/^\/notifications$/, { title: "Notifications", parent: HOME }],
  [/^\/profile$/, { title: "Profile", parent: HOME }],
  [/^\/profile\/edit$/, { title: "Edit profile", parent: PROFILE }],
  [/^\/profile\/password$/, { title: "Change password", parent: PROFILE }],
  [/^\/(profile\/|account\/)?security$/, { title: "Account Security", parent: PROFILE }],
  [/^\/profile\/notifications$/, { title: "Notification settings", parent: PROFILE }],
  [/^\/profile\/terms$/, { title: "Terms & Conditions", parent: PROFILE }],
  [/^\/profile\/privacy$/, { title: "Privacy Policy", parent: PROFILE }],
  [/^\/profile\/delete$/, { title: "Delete account", parent: PROFILE }],
  [/^\/account\/delete$/, { title: "Delete account", parent: PROFILE }],
  [/^\/delete-account$/, { title: "Delete account", parent: PROFILE }],
  [/^\/addresses$/, { title: "Saved addresses", parent: PROFILE }],
  [/^\/payments$/, { title: "Payments", parent: PROFILE }],
  [/^\/wallet$/, { title: "Wallet", parent: PROFILE }],
  [/^\/reviews$/, { title: "Reviews", parent: PROFILE }],
  [/^\/referrals$/, { title: "Referrals", parent: PROFILE }],
  [/^\/support$/, { title: "Help Center", parent: PROFILE }],
  [/^\/support\/tickets$/, { title: "My Tickets", parent: SUPPORT }],
  [/^\/support\/tickets\/[^/]+$/, { title: "Ticket", parent: customerPath("/support/tickets") }],
];

const NOT_FOUND: CustomerPageMeta = { title: "Page not found", parent: HOME };

/** Strip trailing slashes, lower-case, and drop the /customer prefix so rules read naturally. */
function relative(pathname: string): string {
  const p = pathname.replace(/\/+$/, "").toLowerCase();
  const base = customerPath().toLowerCase();
  return p === base ? "" : p.startsWith(`${base}/`) ? p.slice(base.length) : p;
}

/** True for the dashboard home page — the only customer page that keeps the address picker + bell instead of a back bar. */
export function isCustomerHome(pathname: string): boolean {
  return relative(pathname) === "";
}

/** Title + fallback parent for a customer page, or null for Home. */
export function getCustomerPageMeta(pathname: string): CustomerPageMeta | null {
  const rel = relative(pathname);
  if (rel === "") return null;
  return PAGES.find(([re]) => re.test(rel))?.[1] ?? NOT_FOUND;
}
