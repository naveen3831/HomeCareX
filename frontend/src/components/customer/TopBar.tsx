import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { customerPath } from "@/routes/customerPath";
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
 *  - mobile: delivery-location picker (Zomato-style) … bell. No hamburger: the bottom nav and the
 *            Profile tab carry all navigation.
 *  - md+   : ☰ (collapses the sidebar) | brand | location picker … bell
 * The account avatar/menu lives at the bottom of the sidebar (SidebarAccount) and on the Profile page.
 */
export default function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  const unread = useUnreadNotifications();
  const { pathname } = useLocation();
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase();
  const onHome = normalizedPath === customerPath();
  const onReferrals = normalizedPath === customerPath("/referrals");
  const backPath = onReferrals ? customerPath("/profile") : customerPath();
  const backLabel = onReferrals ? "Back to profile" : "Back to home";

  return (
    <header className="customer-topbar sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3  bg-white/85 px-3 shadow-[0_6px_16px_-14px_rgba(30,27,46,.28)] backdrop-blur-xl md:h-[68px] md:px-8">
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

        <Link to={customerPath()} className={clsx("rounded-lg text-lg font-bold tracking-tight", sidebarOpen ? "md:hidden" : "ml-2", "hidden md:inline-flex", FOCUS_RING)}>
          <span className="text-accent">Home</span>
          <span className="text-brand">CareX</span>
        </Link>

        <span
          aria-hidden="true"
          className={clsx(
            "mx-3 hidden h-8 w-px bg-line",
            !sidebarOpen && "md:block",
          )}
        />
        {!onHome && (
          <Link
            to={backPath}
            aria-label={backLabel}
            className={clsx(
              "inline-flex min-h-[44px] items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70 md:hidden",
              FOCUS_RING,
            )}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span>Back</span>
          </Link>
        )}
        <div
          className={clsx(
            "min-w-0 flex-1 md:flex-none",
            !onHome && "hidden md:block",
          )}
        >
          <LocationPicker />
        </div>
      </div>

      <div className={clsx(onReferrals && "hidden md:block")}>
        <NotificationBell count={unread} />
      </div>
    </header>
  );
}
