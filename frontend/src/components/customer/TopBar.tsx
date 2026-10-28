import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { customerPath } from "@/routes/customerPath";
import { useUIStore } from "@/store/useUIStore";
import { getCustomerPageMeta } from "./pageTitles";
import LocationPicker from "./LocationPicker";
import NotificationBell from "./NotificationBell";
import { CUSTOMER_SIDEBAR_ID } from "./Sidebar";
import { FOCUS_RING } from "./focusRing";

interface TopBarProps {
  /** Desktop: is the sidebar expanded? */
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const HAMBURGER =
  "group relative h-10 w-10 shrink-0 rounded-[14px]   from-white to-brand-soft  transition-[box-shadow,transform] duration-200  active:scale-95";
/** Centred bars; the short middle one grows to full width on hover. */
const BAR = "absolute left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-brand transition-all duration-200";

/**
 * Top bar.
 *  - Home        : ☰ (md+, sidebar collapsed) | brand | location picker … bell
 *  - Inner pages : ☰ (md+, sidebar collapsed) | ← Page name … bell (md+ only). The back arrow goes
 *                  back through in-app history, or to the page's parent when it was opened directly.
 * The account avatar/menu lives at the bottom of the sidebar (SidebarAccount) and on the Profile page.
 */
export default function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  const unread = useUnreadNotifications();
  const location = useLocation();
  const { pathname, key } = location;
  const navigate = useNavigate();

  const activeBookingsCount = useUIStore((s) => s.activeBookingsCount);

  // null on Home, which keeps the address picker + bell instead of a back bar.
  const meta = getCustomerPageMeta(pathname);
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase();
  const isExcludedMobileTopBar =
    normalizedPath.startsWith(customerPath("/bookings").toLowerCase()) ||
    normalizedPath === customerPath("/security").toLowerCase() ||
    normalizedPath === customerPath("/profile/security").toLowerCase();

  // Back navigation: Active Bookings retains its entry point (Profile/Dashboard) and avoids looping
  const goBack = () => {
    if (!meta) return;
    if (normalizedPath === customerPath("/notifications").toLowerCase()) {
      navigate(customerPath());
      return;
    }
    if (normalizedPath === customerPath("/referrals").toLowerCase()) {
      navigate(customerPath("/profile"));
      return;
    }
    if (normalizedPath === customerPath("/tracking").toLowerCase()) {
      const fromCandidate =
        (location.state as { origin?: string; from?: string })?.origin ||
        (location.state as { origin?: string; from?: string })?.from;
      let origin =
        fromCandidate && !fromCandidate.includes("/bookings") && !fromCandidate.includes("/tracking")
          ? fromCandidate
          : null;

      if (!origin) {
        try {
          const saved = sessionStorage.getItem("active_bookings_origin");
          if (saved && !saved.includes("/bookings") && !saved.includes("/tracking")) {
            origin = saved;
          }
        } catch {
          // ignore
        }
      }

      if (!origin) {
        origin = meta.parent || customerPath("/profile");
      }

      try {
        sessionStorage.removeItem("active_bookings_origin");
      } catch {
        // ignore
      }
      navigate(origin);
      return;
    }
    if (normalizedPath === customerPath("/payments").toLowerCase()) {
      const fromCandidate =
        (location.state as { origin?: string; from?: string })?.origin ||
        (location.state as { origin?: string; from?: string })?.from;
      let origin =
        fromCandidate && !fromCandidate.includes("/bookings") && !fromCandidate.includes("/payments")
          ? fromCandidate
          : null;

      if (!origin) {
        try {
          const saved = sessionStorage.getItem("payments_origin");
          if (saved && !saved.includes("/bookings") && !saved.includes("/payments")) {
            origin = saved;
          }
        } catch {
          // ignore
        }
      }

      if (!origin) {
        origin = meta.parent || customerPath("/profile");
      }

      try {
        sessionStorage.removeItem("payments_origin");
      } catch {
        // ignore
      }
      navigate(origin);
      return;
    }
    if (key !== "default") navigate(-1);
    else navigate(meta.parent, { replace: true });
  };

  return (
    <header
      className={clsx(
        "customer-topbar sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 bg-white/85 px-3 shadow-[0_6px_16px_-14px_rgba(30,27,46,.28)] backdrop-blur-xl md:h-[68px] md:px-8",
        isExcludedMobileTopBar && "hidden md:flex",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* Only shown while the sidebar is collapsed; when it is open, its own close (X) button lives in the sidebar. */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            aria-expanded={false}
            aria-controls={CUSTOMER_SIDEBAR_ID}
            className={clsx(HAMBURGER, "hidden md:block", FOCUS_RING)}
          >
            <span aria-hidden="true" className={clsx(BAR, "top-[12px] w-5")} />
            <span aria-hidden="true" className={clsx(BAR, "top-[18px] w-3.5 group-hover:w-5")} />
            <span aria-hidden="true" className={clsx(BAR, "top-[25px] w-5")} />
          </button>
        )}

        {meta ? (
          <>
            <Link
              to={customerPath()}
              className={clsx(
                "hidden rounded-lg text-lg font-bold tracking-tight md:inline-flex",
                FOCUS_RING,
              )}
            >
              <span className="text-accent">Home</span>
              <span className="text-brand">CareX</span>
            </Link>
            {normalizedPath === customerPath("/tracking").toLowerCase() ? (
              <div className="flex w-full min-w-0 items-center justify-between pr-1">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={`Back from ${meta.title}`}
                  className={clsx(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand active:opacity-70",
                    FOCUS_RING,
                  )}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Back from {meta.title}</span>
                </button>

                <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  {meta.title}
                </h1>

                {activeBookingsCount !== null && activeBookingsCount > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#a7f3d0]/60 bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#059669]">
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
                    </span>
                    <span>{activeBookingsCount} Live</span>
                  </span>
                ) : (
                  <div className="w-10 shrink-0" aria-hidden="true" />
                )}
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={`Back from ${meta.title}`}
                  className={clsx(
                    "inline-flex min-h-[44px] min-w-0 items-center gap-1 rounded-lg pl-1 pr-1.5 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70",
                    FOCUS_RING,
                  )}
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{meta.title}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <Link
              to={customerPath()}
              className={clsx(
                "rounded-lg text-lg font-bold tracking-tight",
                sidebarOpen ? "md:hidden" : "ml-2",
                "hidden md:inline-flex",
                FOCUS_RING,
              )}
            >
              <span className="text-accent">Home</span>
              <span className="text-brand">CareX</span>
            </Link>

            <span
              aria-hidden="true"
              className={clsx("mx-3 hidden h-8 w-px bg-line", !sidebarOpen && "md:block")}
            />

            {/* One picker at every width (a single instance keeps DOM ids unique). */}
            <div className="min-w-0 flex-1 md:flex-none">
              <LocationPicker />
            </div>
          </>
        )}
      </div>

      <div className={clsx(meta && "hidden", meta && normalizedPath !== customerPath("/tracking").toLowerCase() && "md:block")}>
        <NotificationBell count={unread} />
      </div>
    </header>
  );
}
