
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { customerPath } from "@/routes/customerPath";
import LocationPicker from "./LocationPicker";
import NotificationBell from "./NotificationBell";
import { CUSTOMER_SIDEBAR_ID } from "./Sidebar";
import { FOCUS_RING } from "./focusRing";
import { getCustomerPageMeta } from "./pageTitles";

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const HAMBURGER =
  "group relative h-10 w-10 shrink-0 rounded-[14px] bg-gradient-to-br from-white to-brand-soft shadow-[0_2px_8px_-2px_rgba(30,27,46,.18)] ring-1 ring-line transition-[box-shadow,transform] duration-200 hover:shadow-[0_4px_12px_-2px_rgba(30,27,46,.25)] active:scale-95";

const BAR =
  "absolute left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-brand transition-all duration-200";

const BACK_LINK =
  "inline-flex min-h-[44px] items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] font-semibold text-ink transition-colors hover:text-brand active:opacity-70";

export default function TopBar({
  sidebarOpen,
  onToggleSidebar,
}: TopBarProps) {
  const unread = useUnreadNotifications();
  const { pathname, key } = useLocation();
  const navigate = useNavigate();

  const meta = getCustomerPageMeta(pathname);
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase();

  const onNotifications =
    normalizedPath === customerPath("/notifications").replace(/\/+$/, "").toLowerCase();

  const onReferrals =
    normalizedPath === customerPath("/referrals").replace(/\/+$/, "").toLowerCase();

  const innerPage = meta !== null && !onNotifications && !onReferrals;

  const goBack = () => {
    if (!meta) return;

    if (key !== "default") {
      navigate(-1);
    } else {
      navigate(meta.parent, { replace: true });
    }
  };

  const hamburger = !sidebarOpen && (
    <button
      type="button"
      onClick={onToggleSidebar}
      aria-label="Open sidebar"
      aria-expanded={false}
      aria-controls={CUSTOMER_SIDEBAR_ID}
      className={clsx(
        HAMBURGER,
        "hidden md:block",
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(BAR, "top-[12px] w-5")}
      />
      <span
        aria-hidden="true"
        className={clsx(
          BAR,
          "top-[18px] w-3.5 group-hover:w-5",
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(BAR, "top-[25px] w-5")}
      />
    </button>
  );

  return (
    <header
      data-inner={innerPage ? "true" : undefined}
      className={clsx(
        "customer-topbar sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 px-3 md:h-[68px] md:px-8",
        innerPage
          ? "border-b border-line bg-canvas"
          : "bg-white/85 shadow-[0_6px_16px_-14px_rgba(30,27,46,.28)] backdrop-blur-xl",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {hamburger}

        {/* Back button for customer inner pages. */}
        {innerPage && meta ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={`Back from ${meta.title}`}
            className={clsx(BACK_LINK, FOCUS_RING)}
          >
            <ArrowLeft
              className="h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{meta.title}</span>
          </button>
        ) : (
          <>
            {/* Brand: desktop only when the sidebar is collapsed. */}
            <Link
              to={customerPath()}
              className={clsx(
                "rounded-lg text-lg font-bold tracking-tight",
                sidebarOpen
                  ? "hidden"
                  : "ml-2 hidden md:inline-flex",
                FOCUS_RING,
              )}
              aria-label="HomeCareX home"
            >
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

            {/* Notifications page: mobile back button. */}
            {onNotifications && (
              <Link
                to={customerPath()}
                aria-label="Back to home"
                className={clsx(
                  BACK_LINK,
                  "md:hidden",
                  FOCUS_RING,
                )}
              >
                <ArrowLeft
                  className="h-5 w-5"
                  aria-hidden="true"
                />
                <span>Back</span>
              </Link>
            )}

            {/* Referrals page: mobile back button. */}
            {onReferrals && (
              <Link
                to={customerPath("/profile")}
                aria-label="Back to profile"
                className={clsx(
                  BACK_LINK,
                  "md:hidden",
                  FOCUS_RING,
                )}
              >
                <ArrowLeft
                  className="h-5 w-5"
                  aria-hidden="true"
                />
                <span>Back</span>
              </Link>
            )}

            {/* Location picker is hidden on inner and special pages. */}
            {!onNotifications && !onReferrals && (
              <div className="min-w-0 flex-1 md:flex-none">
                <LocationPicker />
              </div>
            )}
          </>
        )}
      </div>

      {/* Keep the notification bell visible on desktop.
          On mobile, show it only on the main customer page. */}
      <div
        className={clsx(
          (innerPage || onNotifications || onReferrals) &&
            "hidden md:block",
        )}
      >
        <NotificationBell count={unread} />
      </div>
    </header>
  );
}
