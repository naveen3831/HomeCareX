import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Briefcase,
  ClipboardList,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Clock,
  Wrench,
  MapPin,
  Wallet,
  Gift,
  Banknote,
  Receipt,
  TrendingUp,
  Star,
  User,
  LifeBuoy,
  HelpCircle,
  Settings,
  Bell,
  ArrowLeft,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { HomeCarexMark } from "@/components/band/Homecarexmark";
import {
  getAvailability,
  setOnline as setOnlineApi,
  readStoredOnlineStatus,
  writeStoredOnlineStatus,
  PARTNER_ONLINE_STORAGE_KEY,
} from "@/pages/partner/Availability/availability.api";
import { setMockPartnerOnline } from "@/services/mockPartnerJobs";
import "@/styles/admin.css";
import OnlineIndicator from "../components/partner/OnlineIndicator";
import PartnerErrorBoundary from "../components/partner/PartnerErrorBoundary";

// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------

type NavChild = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
};

type NavItem = NavChild & {
  end?: boolean;
  /** Sub-pages. Clicking the parent opens this list. */
  children?: NavChild[];
};

export const NAV: NavItem[] = [
  { key: "home", label: "Home", to: "/partner", icon: Home, end: true },

  {
    key: "jobs",
    label: "My Jobs",
    to: "/partner/jobs",
    icon: Briefcase,
    children: [
      {
        key: "job-requests",
        label: "Job Requests",
        to: "/partner/jobs/requests",
        icon: ClipboardList,
      },
    ],
  },

  { key: "work", label: "Work", to: "/partner/work", icon: Briefcase },

  {
    key: "availability",
    label: "Availability",
    to: "/partner/availability",
    icon: CalendarClock,
    children: [
      {
        key: "working-hours",
        label: "Working Hours",
        to: "/partner/working-hours",
        icon: Clock,
      },
      {
        key: "blackout-dates",
        label: "Blackout Dates",
        to: "/partner/blackout-dates",
        icon: CalendarOff,
      },
      {
        key: "schedule",
        label: "Schedule",
        to: "/partner/schedule",
        icon: CalendarDays,
      },
    ],
  },

  { key: "services", label: "Services", to: "/partner/services", icon: Wrench },
  {
    key: "service-area",
    label: "Service Area",
    to: "/partner/service-area",
    icon: MapPin,
  },

  {
    key: "earnings",
    label: "Earnings",
    to: "/partner/earnings",
    icon: Wallet,
    children: [
      {
        key: "incentives",
        label: "Incentives",
        to: "/partner/incentives",
        icon: Gift,
      },
      {
        key: "payouts",
        label: "Payouts",
        to: "/partner/payouts",
        icon: Banknote,
      },
      {
        key: "transactions",
        label: "Transactions",
        to: "/partner/transactions",
        icon: Receipt,
      },
      {
        key: "wallet",
        label: "Wallet",
        to: "/partner/wallet",
        icon: Wallet,
      },
    ],
  },

  {
    key: "performance",
    label: "Performance",
    to: "/partner/performance",
    icon: TrendingUp,
    children: [
      {
        key: "reviews",
        label: "Reviews",
        to: "/partner/reviews",
        icon: Star,
      },
    ],
  },

  { key: "profile", label: "Profile", to: "/partner/profile", icon: User },
  { key: "support", label: "Support", to: "/partner/support", icon: LifeBuoy },
  { key: "help", label: "Help", to: "/partner/help", icon: HelpCircle },
  {
    key: "system",
    label: "Settings",
    to: "/partner/settings",
    icon: Settings,
    children: [
      { key: "settings-account", label: "Account", to: "/partner/settings/account", icon: User },
      { key: "settings-notifications", label: "Notifications", to: "/partner/settings/notifications", icon: Bell },
      { key: "settings-privacy", label: "Privacy", to: "/partner/settings/privacy", icon: MapPin },
      { key: "settings-security", label: "Security", to: "/partner/settings/security", icon: Shield },
      { key: "settings-other", label: "Other", to: "/partner/settings/other", icon: Globe },
    ],
  },
];

// Parents and children in one list (used for titles and "current page" lookup)
const FLAT_NAV: (NavChild & { parent?: string })[] = NAV.flatMap((n) => [
  n,
  ...(n.children ?? []).map((c) => ({ ...c, parent: n.key })),
]);

// -----------------------------------------------------------------------------
// Page titles
// -----------------------------------------------------------------------------

const PAGE_TITLES: Record<string, string> = {
  "/partner/availability": "Availability",
  "/partner/working-hours": "Working Hours",
  "/partner/availability/hours": "Working Hours",
  "/partner/blackout-dates": "Blackout Dates",
  "/partner/availability/blackout-dates": "Blackout Dates",
  "/partner/schedule": "Schedule",
  "/partner/service-area": "Service Area",
  "/partner/earnings": "Earnings",
  "/partner/jobs": "Job Requests",
};

// Titles that only change the heading
// They also hide the Online/Offline pill
const EXTRA_TITLES: Record<string, string> = {
  "/partner/incentives": "Partner Incentives",
  "/partner/settings": "Settings",
  "/partner/settings/security/password": "Change Password",
  "/partner/settings/security/sessions": "Active Sessions",
  "/partner/settings/security/history": "Login History",
  "/partner/settings/other/terms": "Terms of Service",
  "/partner/settings/other/privacy-policy": "Privacy Policy",
  "/partner/earnings/incentives": "Partner Incentives",
  "/partner/payouts": "Partner Payouts",
  "/partner/earnings/payouts": "Partner Payouts",
  "/partner/transactions": "Partner Transactions",
  "/partner/wallet": "Partner Wallet",
};

// Pages that hide the mobile bottom bar
const HIDE_BOTTOM_NAV = ["/partner/wallet", "/partner/transactions"];

// Bottom tabs.
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
  },
  {
    key: "earnings",
    label: "Earnings",
    to: "/partner/earnings",
    icon: Wallet,
    match: [
      "/partner/earnings",
      "/partner/incentives",
      "/partner/payouts",
      "/partner/transactions",
      "/partner/wallet",
    ],
  },
  {
    key: "profile",
    label: "Profile",
    to: "/partner/profile",
    icon: User,
    match: ["/partner/profile"],
  },
];

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
            : match.some((m) => path === m || path.startsWith(m + "/"));

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
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const BOTTOM_KEYS = BOTTOM_NAV.map((n) => n.key);

// ---- Online status shared with dashboard pages via context ----
const PartnerStatusContext = createContext<{
  online: boolean;
  setOnline: (v: boolean) => void;
}>({
  online: false,
  setOnline: () => {},
});

export const usePartnerStatus = () => useContext(PartnerStatusContext);

// ---- Sidebar groups (keys are top-level NAV keys) ----
const NAV_GROUPS: { groupName: string; keys: string[] }[] = [
  { groupName: "Overview", keys: ["home"] },
  {
    groupName: "Operations",
    keys: ["jobs", "work", "availability", "services", "service-area"],
  },
  { groupName: "Finance", keys: ["earnings", "performance"] },
  { groupName: "Account", keys: ["profile", "support", "help", "system"] },
];

// ---- Sidebar ----
function PartnerSidebar({
  collapsed,
  currentKey,
  currentLabel,
  onToggle,
}: {
  collapsed: boolean;
  currentKey?: string;
  currentLabel?: string;
  onToggle: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name ?? "Partner";

  // Top-level key of the page we are on (a child resolves to its parent)
  const topKeyOf = (key?: string) =>
    FLAT_NAV.find((n) => n.key === key)?.parent ?? key;

  const groupOf = (key?: string) =>
    NAV_GROUPS.find((g) => g.keys.includes(topKeyOf(key) ?? ""))?.groupName ??
    "Overview";

  const [openGroup, setOpenGroup] = useState<string>(groupOf(currentKey));

  // Parent items whose sub-links are expanded
  const [openItems, setOpenItems] = useState<string[]>(() => {
    const top = topKeyOf(currentKey);
    return top ? [top] : [];
  });

  useEffect(() => {
    setOpenGroup(groupOf(currentKey));
    const top = topKeyOf(currentKey);
    if (top) {
      setOpenItems((cur) => (cur.includes(top) ? cur : [...cur, top]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const openItem = (key: string) =>
    setOpenItems((cur) => (cur.includes(key) ? cur : [...cur, key]));

  const toggleItem = (key: string) =>
    setOpenItems((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );

  const cls = ["admin-sidebar", collapsed ? "is-collapsed" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <aside className={cls} aria-label="Partner navigation">
        <div className="sidebar-brand">
          <div
            className="sidebar-brand__top"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              flexDirection: collapsed ? "column" : "row",
              gap: collapsed ? 8 : 0,
            }}
          >
            <div className="sidebar-brand__logo">
              <span className="sidebar-brand__icon">
                <HomeCarexMark size={22} />
              </span>

              {!collapsed && (
                <span className="sidebar-brand__name">HomeCareX</span>
              )}
            </div>

            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
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
                        cur === group.groupName ? "" : group.groupName
                      )
                    }
                  >
                    <span>{group.groupName}</span>

                    <ChevronDown
                      size={14}
                      className={`nav-group__chevron${isOpen ? " is-open" : ""}`}
                    />
                  </button>
                )}

                {isOpen && (
                  <ul className="nav-list">
                    {items.map(({ key, label, to, icon: Icon, end, children }) => {
                      const hasChildren = !!children?.length && !collapsed;
                      const expanded = hasChildren && openItems.includes(key);

                      return (
                        <li key={key}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <NavLink
                              to={to}
                              end={end || hasChildren}
                              title={collapsed ? label : undefined}
                              style={{ flex: 1, minWidth: 0 }}
                              onClick={() => hasChildren && openItem(key)}
                              className={({ isActive }) =>
                                `nav-link${isActive ? " is-active" : ""}`
                              }
                            >
                              <Icon
                                className="nav-link__icon"
                                size={20}
                                aria-hidden
                              />

                              {!collapsed && (
                                <span className="nav-link__label">{label}</span>
                              )}

                              {collapsed && (
                                <span className="sr-only">{label}</span>
                              )}
                            </NavLink>

                            {hasChildren && (
                              <button
                                type="button"
                                aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
                                aria-expanded={expanded}
                                onClick={() => toggleItem(key)}
                                style={{
                                  background: "none",
                                  border: 0,
                                  padding: "0.5rem",
                                  color: "inherit",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                }}
                              >
                                <ChevronDown
                                  size={14}
                                  style={{
                                    transition: "transform 150ms",
                                    transform: expanded
                                      ? "rotate(180deg)"
                                      : "none",
                                  }}
                                />
                              </button>
                            )}
                          </div>

                          {/* Sub-links open under the parent */}
                          {expanded && (
                            <ul
                              className="nav-list"
                              style={{
                                marginLeft: "1.6rem",
                                paddingLeft: "0.25rem",
                                borderLeft: "1px solid rgba(148,163,184,0.35)",
                              }}
                            >
                              {children!.map(
                                ({ key: ck, label: cl, to: ct, icon: CIcon }) => (
                                  <li key={ck}>
                                    <NavLink
                                      to={ct}
                                      className={({ isActive }) =>
                                        `nav-link${isActive ? " is-active" : ""}`
                                      }
                                    >
                                      <CIcon
                                        className="nav-link__icon"
                                        size={16}
                                        aria-hidden
                                      />
                                      <span className="nav-link__label">{cl}</span>
                                    </NavLink>
                                  </li>
                                )
                              )}
                            </ul>
                          )}
                        </li>
                      );
                    })}
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
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={18} />

            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// -----------------------------------------------------------------------------
// Partner Layout
// -----------------------------------------------------------------------------

export default function PartnerLayout() {
  const [online, setOnlineState] = useState<boolean>(
    () => readStoredOnlineStatus() ?? false
  );

  const setOnline = useCallback((next: boolean) => {
    setOnlineState(next);
    writeStoredOnlineStatus(next);
    setMockPartnerOnline("partner-1", next);
    void setOnlineApi(next).catch(() => {});
  }, []);

  useEffect(() => {
    setMockPartnerOnline("partner-1", online);
  }, [online]);

  useEffect(() => {
    let active = true;
    getAvailability()
      .then((avail) => {
        if (!active) return;
        setOnlineState(avail.isOnline);
        writeStoredOnlineStatus(avail.isOnline);
        setMockPartnerOnline("partner-1", avail.isOnline);
      })
      .catch(() => {});

    const onStorage = (e: StorageEvent) => {
      if (e.key === PARTNER_ONLINE_STORAGE_KEY) {
        const next = readStoredOnlineStatus();
        if (next !== null) {
          setOnlineState(next);
          setMockPartnerOnline("partner-1", next);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const [collapsedPref, setCollapsedPref] = useState(false);

  const [navVisible, setNavVisible] = useState(true);

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const collapsed = collapsedPref && isDesktop;

  const { pathname } = useLocation();
  const navigate = useNavigate();

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

      if (y <= 24) {
        setNavVisible(true);
      } else {
        setNavVisible(delta < 0);
      }

      last = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  // Longest matching route wins (child pages beat their parent)
  const current = FLAT_NAV.filter((n) =>
    n.to === "/partner"
      ? cleanPath === "/partner"
      : cleanPath === n.to || cleanPath.startsWith(n.to + "/")
  ).sort((a, b) => b.to.length - a.to.length)[0];

  const title =
    PAGE_TITLES[cleanPath] ??
    EXTRA_TITLES[cleanPath] ??
    current?.label ??
    "Partner";

  const minimalHeader = Object.keys(PAGE_TITLES).includes(cleanPath);

  const hideStatusPill = Object.keys(EXTRA_TITLES).includes(cleanPath);

  // Support and Help screens fill the space between the navbar and the bottom of the screen,
  // so the page itself never scrolls (lists and chats scroll inside, scrollbar hidden).
  const fullBleed =
    cleanPath === "/partner/support" ||
    cleanPath.startsWith("/partner/support/") ||
    cleanPath === "/partner/help";

  // A single ticket is a chat: it owns the whole mobile screen (own top bar, composer at the bottom).
  const isTicketThread = /^\/partner\/support\/[^/]+$/.test(cleanPath);

  // Support and Help screens use the whole mobile screen: no bottom tab bar.
  const hideBottomNav = HIDE_BOTTOM_NAV.includes(cleanPath) || fullBleed;

  // Mobile back button
  const showBack = cleanPath !== "/partner";

  const isTabRoot = BOTTOM_NAV.some((n) => n.to === cleanPath);

  const goBack = () => {
    if (isTabRoot) {
      return navigate("/partner");
    }

    const hasHistory = (window.history.state as { idx?: number } | null)?.idx;

    // Opened directly (no history): go up one level inside Settings.
    if (!hasHistory && cleanPath.startsWith("/partner/settings/")) {
      const parts = cleanPath.split("/");
      return navigate(parts.length > 4 ? parts.slice(0, -1).join("/") : "/partner");
    }

    if (hasHistory) {
      return navigate(-1);
    }

    navigate(
      current && !BOTTOM_KEYS.includes(current.parent ?? current.key)
        ? "/partner/profile"
        : "/partner"
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PartnerStatusContext.Provider value={{ online, setOnline }}>
      <div
        className={`flex bg-slate-50 text-slate-900 ${
          fullBleed ? "h-dvh overflow-hidden" : "min-h-screen"
        }`}
      >
        <PartnerSidebar
          collapsed={collapsed}
          currentKey={current?.key}
          currentLabel={current?.label}
          onToggle={() => setCollapsedPref((v) => !v)}
        />

        <div className={`flex min-w-0 flex-1 flex-col ${fullBleed ? "min-h-0" : ""}`}>
          {/* Header (a ticket chat has its own top bar on mobile) */}
          <header
            className={`sticky top-0 z-20 h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-2 sm:h-16 sm:px-6 ${
              isTicketThread ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-3">
              {showBack && (
                <button
                  onClick={goBack}
                  aria-label="Go back"
                  title="Back"
                  className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                >
                  <ArrowLeft size={20} />
                </button>
              )}

              <h1 className="truncate text-base font-semibold text-[#4338ca] sm:text-lg">
                {title}
              </h1>
            </div>

            <div
              className={`shrink-0 items-center gap-0.5 sm:gap-3 ${
                minimalHeader ? "hidden lg:flex" : "flex"
              }`}
            >
              {!hideStatusPill &&
                (fullBleed ? (
                  // Support and Help screens: Online/Offline pill is desktop only
                  <div className="hidden lg:block">
                    <OnlineIndicator online={online} onChange={setOnline} />
                  </div>
                ) : (
                  <OnlineIndicator online={online} onChange={setOnline} />
                ))}

              <button
                aria-label="Notifications"
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
              >
                <Bell size={20} />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main
            className={
              fullBleed
                ? `flex min-h-0 flex-1 flex-col overflow-hidden ${
                    hideBottomNav
                      ? ""
                      : "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
                  }`
                : `px-4 py-6 sm:px-6 lg:pb-8 ${hideBottomNav ? "pb-8" : "pb-24"}`
            }
          >
            <PartnerErrorBoundary resetKey={pathname}>
              <Outlet />
            </PartnerErrorBoundary>
          </main>
        </div>

        {!hideBottomNav && (
          <BottomNav visible={navVisible} path={cleanPath} />
        )}
      </div>
    </PartnerStatusContext.Provider>
  );
}