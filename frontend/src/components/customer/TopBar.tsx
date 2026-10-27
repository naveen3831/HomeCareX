import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
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
 *  - Home        : ☰ (md+, sidebar collapsed) | brand | location picker … bell
 *  - Inner pages : ☰ (md+, sidebar collapsed) | ← Page name … bell (md+ only). The back arrow goes
 *                  back through in-app history, or to the page's parent when it was opened directly.
 *  - Home : phones — delivery-location picker … bell.  md+ — ☰ | brand | location picker … bell.
 *  - every other page, at every width: ← back arrow + the page name (see pageTitles.ts), with ☰ in front of
 *    it on md+ while the sidebar is collapsed, and the bell at the right on md+. No picker, no brand.
 *    The arrow returns to the previous in-app page, or to the page's parent when the page was opened
 *    directly (deep link / refresh) so it never leaves the app.
 * CustomerLayout pins the bar to the top of the screen on every page, so it never scrolls away.
 * The account avatar/menu lives at the bottom of the sidebar (SidebarAccount) and on the Profile page.
 */
export default function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  const unread = useUnreadNotifications();
  const { pathname, key } = useLocation();
  const navigate = useNavigate();

  // React Router gives the first entry of a session the key "default": nothing to go back to.
  // null on Home. Everywhere else the bar becomes "← Page name".
  const meta = getCustomerPageMeta(pathname);
  const inner = meta !== null;

  // key === "default" means this is the first entry of the session, so there is nothing to go back to.
  const goBack = () => {
    if (!meta) return;
    if (key !== "default") navigate(-1);
    else navigate(meta.parent, { replace: true });
  };

  // Desktop only: only shown while the sidebar is collapsed; when it is open, its own close (X) button lives in the sidebar.
  const hamburger = !sidebarOpen && (
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
  );

  return (
    <header
      data-inner={inner ? "true" : undefined}
      className={clsx(
        "customer-topbar flex h-[64px] items-center justify-between gap-3 px-3 md:h-[68px] md:px-8",
        inner ? "border-b border-line bg-canvas" : "bg-white/85 shadow-[0_6px_16px_-14px_rgba(30,27,46,.28)] backdrop-blur-xl",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {meta ? (
          <>
            {hamburger}
            <button
              type="button"
              onClick={goBack}
              aria-label={`Back from ${meta.title}`}
              className={clsx(
                "inline-flex min-h-[44px] min-w-0 items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70",
                FOCUS_RING,
              )}
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{meta.title}</span>
            </button>
          </>
        ) : (
          <>
            {hamburger}
            <Link
              to={customerPath()}
  const { pathname } = useLocation();
  // On the notifications page the address picker gives way to a back button that returns to the home page.
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase();
  const onNotifications = normalizedPath === customerPath("/notifications");
  // On the referrals page (mobile) the address picker and bell give way to a back button that returns to Profile.
  const onReferrals = normalizedPath === customerPath("/referrals");

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
        {onNotifications ? (
          <Link
            to={customerPath()}
            aria-label="Back to home"
            className={clsx(
              "inline-flex min-h-[44px] items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70 md:hidden",
              FOCUS_RING,
            )}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span>Back</span>
          </Link>
        ) : (
          <>
            {onReferrals && (
              <Link
                to={customerPath("/profile")}
                aria-label="Back to profile"
                className={clsx(
                  "inline-flex min-h-[44px] items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70 md:hidden",
                  FOCUS_RING,
                )}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span>Back</span>
              </Link>
            )}
            {/* One picker at every width (a single instance keeps DOM ids unique). Hidden on mobile for referrals. */}
            <div
              className={clsx(
                "min-w-0 flex-1 md:flex-none",
                onReferrals && "hidden md:block",
              )}
            >
              <span className="text-accent">Home</span>
              <span className="text-brand">CareX</span>
            </Link>

            <span
              aria-hidden="true"
              className={clsx("mx-3 hidden h-8 w-px bg-line", !sidebarOpen && "md:block")}
            />

            <div className="min-w-0 flex-1 md:flex-none">
              <LocationPicker />
            </div>
          </>
        )}
      </div>

      {/* Phones: bell on Home only. md+: always. */}
      <div className={clsx(inner && "hidden md:block")}>
      <div className={clsx(onReferrals && "hidden md:block")}>
        <NotificationBell count={unread} />
      </div>
    </header>
  );
}
