import { useState, useEffect, createContext, useContext } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  Briefcase,
  ClipboardList,
  CalendarClock,
  Wrench,
  Wallet,
  Star,
  User,
  LifeBuoy,
  Settings,
  Bell,
  ArrowLeft,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { HomeCarexMark } from "@/components/band/Homecarexmark";
import OnlineIndicator from "@/components/partner/OnlineIndicator";
import PartnerErrorBoundary from "@/components/partner/PartnerErrorBoundary";
import "@/styles/admin.css";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** True when `path` is `base` or a child of it ("/partner/work" matches
 *  "/partner/work/requests" but not "/partner/workshop"). */
const isPathActive = (path: string, base: string) =>
  path === base || path.startsWith(`${base}/`);

// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------

export const NAV = [
  { key: "home", label: "Home", to: "/partner", icon: Home, end: true },
  { key: "jobs", label: "My Jobs", to: "/partner/jobs", icon: ClipboardList },
  { key: "work", label: "Work", to: "/partner/work", icon: Briefcase },
  {
    key: "availability",
    label: "Availability",
    to: "/partner/availability",
    icon: CalendarClock,
  },
  { key: "services", label: "Services", to: "/partner/services", icon: Wrench },
  { key: "earnings", label: "Earnings", to: "/partner/earnings", icon: Wallet },
  {
    key: "performance",
    label: "Performance",
    to: "/partner/performance",
    icon: Star,
  },
  { key: "profile", label: "Profile", to: "/partner/profile", icon: User },
  { key: "support", label: "Support", to: "/partner/support", icon: LifeBuoy },
  { key: "system", label: "System", to: "/partner/system", icon: Settings },
];

// -----------------------------------------------------------------------------
// Page titles
// -----------------------------------------------------------------------------

// Titles that also switch to the minimal header on mobile
const PAGE_TITLES: Record<string, string> = {
  "/partner/availability": "Availability",
  "/partner/working-hours": "Working Hours",
  "/partner/availability/hours": "Working Hours",
  "/partner/blackout-dates": "Blackout Dates",
  "/partner/availability/blackout-dates": "Blackout Dates",
  "/partner/schedule": "Schedule",
  "/partner/earnings": "Earnings",
  "/partner/jobs": "My Jobs",
  "/partner/jobs/requests": "Job Requests",
};

// Titles that only change the heading; they also hide the Online/Offline pill
const EXTRA_TITLES: Record<string, string> = {
  "/partner/incentives": "Partner Incentives",
  "/partner/earnings/incentives": "Partner Incentives",
  "/partner/payouts": "Partner Payouts",
  "/partner/earnings/payouts": "Partner Payouts",
  "/partner/transactions": "Partner Transactions",
  "/partner/wallet": "Partner Wallet",
};

// Pages that hide the mobile bottom bar
const HIDE_BOTTOM_NAV = ["/partner/wallet", "/partner/transactions"];

// Bottom tabs. My Jobs stays reachable through the sidebar.
const BOTTOM_NAV = [
  {
    key: "home",
    label: "Home",
    to: "/partner",
    icon: Home,
    match: ["/partner"],
    exact: true,
  },
  {
    key: "work",
    label: "Work",
    to: "/partner/work",
    icon: Briefcase,
    match: ["/partner/work"],
    exact: false,
  },
  {
    key: "availability",
    label: "Availability",
    to: "/partner/availability",
    icon: CalendarClock,
    match: [
      "/partner/availability",
      "/partner/working-hours",
      "/partner/blackout-dates",
      "/partner/schedule",
    ],
    exact: false,
  },
  {
    key: "earnings",
    label: "Earnings",
    to: "/partner/earnings",
    icon: Wallet,
    match: ["/partner/earnings"],
    exact: false,
  },
  {
    key: "profile",
    label: "Profile",
    to: "/partner/profile",
    icon: User,
    match: ["/partner/profile"],
    exact: false,
  },
];

export const BOTTOM_KEYS = BOTTOM_NAV.map((n) => n.key);

function BottomNav({ visible, path }: { visible: boolean; path: string }) {
  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white transition-transform duration-300 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex h-14 max-w-md items-stretch justify-around">
        {BOTTOM_NAV.map(({ key, label, to, icon: Icon, match, exact }) => {
          const active = exact
            ? path === to
            : match.some((m) => isPathActive(path, m));

          return (
            <li key={key} className="flex-1">
              <NavLink
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] ${
                  active ? "text-[#4338ca]" : "text-slate-500"
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---- Online status shared with dashboard pages via context ----

const PartnerStatusContext = createContext<{
  online: boolean;
  setOnline: (v: boolean) => void;
}>({
  online: false,
  setOnline: () => {},
});

export const usePartnerStatus = () => useContext(PartnerStatusContext);

// ---- Sidebar groups ----

const NAV_GROUPS: { groupName: string; keys: string[] }[] = [
  { groupName: "Overview", keys: ["home"] },
  { groupName: "Operations", keys: ["jobs", "work", "availability", "services"] },
  { groupName: "Finance", keys: ["earnings", "performance"] },
  { groupName: "Account", keys: ["profile", "support", "system"] },
];

// ---- Sidebar ----

function PartnerSidebar({
  collapsed,
  currentLabel,
}: {
  collapsed: boolean;
  currentLabel?: string;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name || "Partner";

  const groupOf = (label?: string) =>
    NAV_GROUPS.find((g) =>
      g.keys.some((k) => NAV.find((n) => n.key === k)?.label === label),
    )?.groupName ?? "Overview";

  const [openGroup, setOpenGroup] = useState<string>(groupOf(currentLabel));

  useEffect(() => {
    setOpenGroup(groupOf(currentLabel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const cls = ["admin-sidebar", collapsed ? "is-collapsed" : ""]
    .filter(Boolean)
    .join(" ");

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside className={cls} aria-label="Partner navigation">
      <div className="sidebar-brand">
        <div className="sidebar-brand__top">
          <div className="sidebar-brand__logo">
            <span className="sidebar-brand__icon">
              <HomeCarexMark size={22} />
            </span>

            {!collapsed && (
              <span className="sidebar-brand__name">HomeCareX</span>
            )}
          </div>
        </div>

        {!collapsed && (
          <p className="sidebar-brand__guide">
            {currentLabel ? `Partner / ${currentLabel}` : "Partner Console"}
          </p>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => group.keys.includes(n.key));
          const isOpen = collapsed || openGroup === group.groupName;

          return (
            <div key={group.groupName} className="nav-group">
              {!collapsed && (
                <button
                  type="button"
                  className="nav-group__title nav-group__toggle"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenGroup((cur) =>
                      cur === group.groupName ? "" : group.groupName,
                    )
                  }
                >
                  <span>{group.groupName}</span>

                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`nav-group__chevron${isOpen ? " is-open" : ""}`}
                  />
                </button>
              )}

              {isOpen && (
                <ul className="nav-list">
                  {items.map(({ key, label, to, icon: Icon, end }) => (
                    <li key={key}>
                      <NavLink
                        to={to}
                        end={end}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                          `nav-link${isActive ? " is-active" : ""}`
                        }
                      >
                        <Icon
                          className="nav-link__icon"
                          size={20}
                          aria-hidden="true"
                        />

                        {collapsed ? (
                          <span className="sr-only">{label}</span>
                        ) : (
                          <span className="nav-link__label">{label}</span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer__user sidebar-footer__user-btn"
          title={collapsed ? displayName : undefined}
          onClick={() => navigate("/partner/profile")}
        >
          <span className="avatar">
            {displayName.charAt(0).toUpperCase()}
          </span>

          {!collapsed && <span className="profile-name">{displayName}</span>}
        </button>

        <button
          type="button"
          className="sidebar-signout-btn"
          title="Sign out"
          onClick={() => void handleSignOut()}
        >
          <LogOut size={18} aria-hidden="true" />

          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Partner Layout
// -----------------------------------------------------------------------------

export default function PartnerLayout() {
  const [online, setOnline] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const collapsed = collapsedPref && isDesktop;

  const { pathname } = useLocation();
  const navigate = useNavigate();

  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  // Hide bottom nav when scrolling down, show it when scrolling up
  useEffect(() => {
    setNavVisible(true);

    let last = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;

      if (Math.abs(delta) < 8) {
        return;
      }

      setNavVisible(y <= 24 ? true : delta < 0);

      last = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const current = NAV.find((n) =>
    n.end ? cleanPath === n.to : isPathActive(cleanPath, n.to),
  );

  const title =
    PAGE_TITLES[cleanPath] ??
    EXTRA_TITLES[cleanPath] ??
    current?.label ??
    "Partner";

  const minimalHeader = cleanPath in PAGE_TITLES;
  const hideStatusPill = cleanPath in EXTRA_TITLES;
  const hideBottomNav = HIDE_BOTTOM_NAV.includes(cleanPath);

  // Mobile back button
  const showBack = cleanPath !== "/partner";
  const isTabRoot = BOTTOM_NAV.some((n) => n.to === cleanPath);

  const goBack = () => {
    if (isTabRoot) {
      navigate("/partner");

      return;
    }

    // React Router stores the history index; 0 / undefined means first entry
    const idx = (window.history.state as { idx?: number } | null)?.idx;

    if (idx) {
      navigate(-1);

      return;
    }

    navigate(
      current && !BOTTOM_KEYS.includes(current.key)
        ? "/partner/profile"
        : "/partner",
    );
  };

  return (
    <PartnerStatusContext.Provider value={{ online, setOnline }}>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <PartnerSidebar collapsed={collapsed} currentLabel={current?.label} />

        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-2 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] lg:hidden"
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setCollapsedPref((v) => !v)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] lg:inline-flex"
              >
                {collapsed ? (
                  <PanelLeftOpen size={20} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={20} aria-hidden="true" />
                )}
              </button>

              <h1 className="truncate text-base font-semibold text-[#4338ca] sm:text-lg">
                {title}
              </h1>
            </div>

            <div
              className={`shrink-0 items-center gap-0.5 sm:gap-3 ${
                minimalHeader ? "hidden lg:flex" : "flex"
              }`}
            >
              {!hideStatusPill && (
                <OnlineIndicator online={online} onChange={setOnline} />
              )}

              <button
                type="button"
                aria-label="Notifications"
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
              >
                <Bell size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main
            className={`px-4 py-6 sm:px-6 lg:pb-8 ${
              hideBottomNav ? "pb-8" : "pb-24"
            }`}
          >
            <PartnerErrorBoundary resetKey={pathname}>
              <Outlet />
            </PartnerErrorBoundary>
          </main>
        </div>

        {!hideBottomNav && <BottomNav visible={navVisible} path={cleanPath} />}
      </div>
    </PartnerStatusContext.Provider>
  );
}