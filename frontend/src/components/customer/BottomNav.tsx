import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { BOTTOM_NAV_ITEMS, type CustomerNavItem } from "./customerNav";
import { FOCUS_RING } from "./focusRing";

const norm = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path).toLowerCase();

/** A tab is active only on its own page — never on the pages reached from it. */
const isItemActive = (pathname: string, { to }: CustomerNavItem) => norm(pathname) === norm(to);

/**
 * Mobile bottom navigation (below md): Categories / Services / Home / My Bookings / Profile.
 * Everything else (Account, Support, Referrals…) lives on the Profile tab.
 *
 * Design
 *  - A flat, full-width bar fixed to the bottom of the screen, with a thin top border and a soft shadow.
 *  - Five equal columns (centred, max-w-md). Every tab is an icon + a short label.
 *  - The ACTIVE tab shows its icon in a filled brand pill with a bold label and aria-current="page"
 *    (never colour alone). Inactive tabs are quiet and tint on hover. Only the five tab pages themselves
 *    light a tab: service details, the booking flow, booking details, Addresses, Wallet, Support… leave
 *    every tab plain.
 *
 * Behaviour
 *  - Safe area: the bar adds env(safe-area-inset-bottom) as bottom padding (needs viewport-fit=cover in
 *    index.html), so tabs never sit under the iPhone home indicator.
 *  - Touch targets: every tab is at least 60px tall and a fifth of the bar wide (WCAG minimum is 44px).
 *  - Press feedback uses motion-safe: so it is skipped for prefers-reduced-motion.
 *  - Hidden at md and up (the Sidebar takes over) and on focused full pages (see CustomerLayout).
 */
export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-panel pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_-8px_rgba(30,27,46,0.18)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const { label, to, icon: Icon } = item;
          const active = isItemActive(pathname, item);

          return (
            <li key={to} className="min-w-0">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-none py-1.5 transition-colors",
                  FOCUS_RING,
                  active ? "text-brand" : "text-muted hover:text-ink",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-12 items-center justify-center rounded-full bg-brand text-white transition-all duration-200 motion-safe:group-active:scale-95"
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200 group-hover:bg-canvas motion-safe:group-active:scale-90"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                )}
                <span
                  className={clsx(
                    "block w-full whitespace-nowrap px-0.5 text-center text-[10px] leading-tight tracking-tight",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}