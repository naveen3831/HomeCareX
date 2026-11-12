import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  BottomNav,
  LoadingState,
  OfflineBanner,
  RouteErrorBoundary,
  Sidebar,
  TopBar,
} from "@/components/customer";
import FirstAddressGate from "@/components/customer/FirstAddressGate";
import { useHiddenPageScrollbar } from "@/hooks/useHiddenPageScrollbar";
import { useSidebarOpen } from "@/hooks/useSidebarOpen";
import { customerPath } from "@/routes/customerPath";

/**
 * CustomerLayout — the shell every /customer/* page renders inside.
 *  - md+   : Sidebar (left, grouped; the TopBar hamburger collapses it) + TopBar + content
 *  - mobile: TopBar + content + BottomNav (Categories / Services / Home / My Bookings / Profile).
 *            The TopBar is address picker + bell on Home and "← Page name" everywhere else, and is
 *            pinned to the top of the screen on every page. A bottom tab lights up only on its own
 *            page. No hamburger: the rest of the menu (Account, Support, Referrals, Log out…)
 *            lives on the Profile page.
 * The content area always shows something: a spinner while a page chunk loads,
 * an error card if a page crashes, and an offline banner when the network drops.
 * `min-w-0` on the column stops wide content from causing horizontal scroll.
 */
export default function CustomerLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  // After a page change, move focus to the content area so keyboard and screen-reader users start at the new page, not at the top bar.
  // Skipped on first load, and for query-string-only changes (filters, pagination) because only the path is a dependency.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      if (typeof document !== "undefined" && (!document.hasFocus || document.hasFocus())) {
        mainRef.current?.focus({ preventScroll: true });
      }
    } catch {
      // Ignore Permissions-Policy violation: focus-without-user-activation in embedded iframes
    }
  }, [pathname]);
  const [sidebarOpen, toggleSidebar] = useSidebarOpen();
  useHiddenPageScrollbar();
  // Edit profile / Change password / Notifications settings / Terms / Privacy are focused full pages on phones: no bottom nav
  // (the top bar still shows the back arrow + title like every other inner page).
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  const isBookingSuccess =
    path.startsWith(customerPath("/booking/success").toLowerCase()) ||
    path.startsWith(customerPath("/booking/booked").toLowerCase());

  const focusPage =
    isBookingSuccess ||
    [
      customerPath("/profile/edit"),
      customerPath("/profile/password"),
      customerPath("/profile/notifications"),
      customerPath("/profile/terms"),
      customerPath("/profile/privacy"),
    ].includes(path);

  return (
    <div className="customer-shell flex min-h-screen overflow-x-clip bg-canvas">
      <a
        href="#customer-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <FirstAddressGate />

      <Sidebar open={sidebarOpen} onClose={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The wrapper is the sticky element: a sticky child cannot leave a wrapper that is only as tall as itself, which is why the bar scrolled away.
            It is shown on every page (Home included) and keeps clear of the phone's status bar / notch. */}
        <div className="sticky top-0 z-30 bg-canvas pt-[env(safe-area-inset-top)] md:bg-transparent md:pt-0">
          <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        </div>
        <OfflineBanner />

        <main
          ref={mainRef}
          id="customer-main"
          tabIndex={-1}
          className={clsx(
            "flex-1 outline-none md:px-8",
            isBookingSuccess
              ? "px-3 sm:px-4 py-2.5 sm:py-3 md:py-5 md:pb-6"
              : "px-4 py-6 md:pb-6",
            // Leave room for the fixed bottom nav (it shows on every page, Profile included).
            focusPage
              ? isBookingSuccess
                ? "pb-[calc(1rem+env(safe-area-inset-bottom))]"
                : "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(5rem+env(safe-area-inset-bottom))]",
          )}
        >
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      {!focusPage && <BottomNav />}
    </div>
  );
}
