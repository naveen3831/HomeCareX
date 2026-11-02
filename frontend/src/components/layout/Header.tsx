import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Clock, Mail, Phone, MapPin, ChevronDown, Bell, Check, X, Tag, ArrowRight } from "lucide-react";
import MobileDrawer from "./MobileDrawer";

/* =========================================================
   HomeCareX Header
   Brand Colors:
   Navy: #0e2439 / #1e1b4b
   Orange: #ff8a3d / #f97316
========================================================= */

const styles = `
  .hcx-hd {
    font-family:
      "DM Sans",
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  @keyframes hcx-header-drop {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hcx-header-drop {
    animation: hcx-header-drop 0.5s cubic-bezier(.2,.7,.2,1) both;
  }

  /* TOP BAR */

  .hcx-topbar {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transition:
      grid-template-rows 0.35s ease,
      opacity 0.25s ease;
  }

  .hcx-topbar.collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .hcx-topbar > div {
    overflow: hidden;
    min-height: 0;
  }

  .hcx-top-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #cbd5e1;
    transition: color 0.2s ease;
  }

  .hcx-top-link:hover {
    color: #ffffff;
  }

  /* DESKTOP NAVIGATION */

  .hcx-nav-link {
    position: relative;
    padding: 8px 2px;
    font-weight: 500;
    color: #475569;
    transition: color 0.2s ease;
  }

  .hcx-nav-link::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 3px;
    border-radius: 999px;
    background: #ff8a3d;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.25s ease;
  }

  .hcx-nav-link:hover {
    color: #0f172a;
  }

  .hcx-nav-link:hover::after,
  .hcx-nav-link.active::after {
    transform: scaleX(1);
  }

  .hcx-nav-link.active {
    color: #0f172a;
    font-weight: 700;
  }

  /* LOGIN BUTTON */

  .hcx-login {
    position: relative;
    overflow: hidden;
  }

  .hcx-login::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    transform: translateX(-120%) skewX(-20deg);
    transition: transform 0.65s ease;
  }

  .hcx-login:hover::before {
    transform: translateX(120%) skewX(-20deg);
  }

  /* MOBILE HAMBURGER */

  .hcx-menu-bar {
    display: block;
    width: 22px;
    height: 2px;
    border-radius: 999px;
    background: #1e1b4b;
    transition:
      transform 0.3s ease,
      opacity 0.2s ease;
  }

  .hcx-menu.open .hcx-menu-bar:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
  }

  .hcx-menu.open .hcx-menu-bar:nth-child(2) {
    opacity: 0;
  }

  .hcx-menu.open .hcx-menu-bar:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
  }

  /* ACCESSIBILITY */

  .hcx-hd a:focus-visible,
  .hcx-hd button:focus-visible {
    outline: 3px solid #ff8a3d;
    outline-offset: 3px;
    border-radius: 10px;
  }

  .hcx-top-link:focus-visible {
    outline-color: #ffffff;
  }

  /* REDUCED MOTION */

  @media (prefers-reduced-motion: reduce) {
    .hcx-hd *,
    .hcx-hd *::before,
    .hcx-hd *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  /* MOBILE */

  @media (max-width: 767px) {
    .hcx-topbar {
      display: none !important;
    }
  }
`;

/* =========================================================
   CONTACT INFORMATION
========================================================= */

const contact = {
  phone: "+91 98765 43210",
  phoneHref: "tel:+919876543210",
  email: "support@homecarex.com",
  hours: "Mon to Sat, 8 AM to 8 PM",
};

/* =========================================================
   NAVIGATION
========================================================= */

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services", end: false },
  { to: "/reviews", label: "Reviews", end: true },
  { to: "/about", label: "About", end: true },
  { to: "/contact", label: "Contact", end: true },
];

/* =========================================================
   HEADER COMPONENT
========================================================= */

const CITIES = [
  { name: "Hyderabad", state: "Telangana" },
  { name: "Bengaluru", state: "Karnataka" },
  { name: "Mumbai", state: "Maharashtra" },
  { name: "Delhi NCR", state: "Delhi" },
  { name: "Chennai", state: "Tamil Nadu" },
  { name: "Pune", state: "Maharashtra" },
  { name: "Kolkata", state: "West Bengal" },
  { name: "Ahmedabad", state: "Gujarat" },
];

interface NotificationItem {
  id: string;
  title: string;
  time: string;
  message: string;
  badge?: string;
  badgeColor?: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  actionText?: string;
  actionUrl?: string;
  couponCode?: string;
  read: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Special Welcome Offer",
    time: "Just now",
    message: "Get flat 20% off on your first service booking with coupon code HOME20.",
    badge: "20% OFF",
    badgeColor: "bg-orange-100 text-orange-700",
    cardBg: "bg-orange-50/70",
    cardBorder: "border-orange-200/80",
    titleColor: "text-orange-800",
    actionText: "Book Now",
    actionUrl: "/services",
    couponCode: "HOME20",
    read: false,
  },
  {
    id: "notif-2",
    title: "AC Servicing Season",
    time: "2h ago",
    message: "Book AC inspection and gas refill starting from ₹499 with 30-day service warranty.",
    badge: "Trending",
    badgeColor: "bg-blue-100 text-blue-700",
    cardBg: "bg-blue-50/70",
    cardBorder: "border-blue-200/80",
    titleColor: "text-blue-800",
    actionText: "View AC Service",
    actionUrl: "/services?category=appliance-repair-service",
    read: false,
  },
  {
    id: "notif-3",
    title: "Verified Pros in Locality",
    time: "1d ago",
    message: "All service partners in your city have completed 100% background and police verification.",
    badge: "Verified",
    badgeColor: "bg-emerald-100 text-emerald-700",
    cardBg: "bg-emerald-50/50",
    cardBorder: "border-emerald-200/70",
    titleColor: "text-slate-800",
    actionText: "Learn More",
    actionUrl: "/about",
    read: false,
  },
];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    try {
      return localStorage.getItem("hcx_city") || "Hyderabad";
    } catch {
      return "Hyderabad";
    }
  });
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem("hcx_notifications");
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      localStorage.setItem("hcx_notifications", JSON.stringify(updated));
    } catch {}
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    try {
      localStorage.setItem("hcx_notifications", JSON.stringify(updated));
    } catch {}
  };

  const handleCopyCoupon = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
    } catch {}
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  /* HEADER HEIGHT */
  useEffect(() => {
    const element = headerRef.current;
    if (!element) return undefined;

    const resizeObserver = new ResizeObserver((entries) => {
      if (window.scrollY > 8) return;

      const entry = entries[0];
      const height =
        entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;

      document.documentElement.style.setProperty(
        "--hcx-nav",
        `${Math.round(height)}px`
      );
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      document.documentElement.style.removeProperty("--hcx-nav");
    };
  }, []);

  /* SCROLL BEHAVIOR */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /* CLOSE MENU WHEN ROUTE CHANGES */
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  /* ESCAPE KEY */
  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  /* MODALS ESCAPE & BODY SCROLL LOCK */
  useEffect(() => {
    const isAnyModalOpen = isNotificationOpen || isCityModalOpen;
    if (!isAnyModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNotificationOpen(false);
        setIsCityModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationOpen, isCityModalOpen]);

  return (
    <header
      ref={headerRef}
      className={`hcx-hd sticky top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <style>{styles}</style>

      {/* TOP INFORMATION BAR */}
      <div
        className={`hcx-topbar hidden md:grid ${scrolled ? "collapsed" : ""}`}
      >
        <div>
          <div className="flex min-h-10 items-center justify-between bg-[#0e2439] px-6 text-xs text-slate-300">
            <div className="hidden items-center gap-6 lg:inline-flex">
              <span className="inline-flex items-center gap-2 text-slate-300">
                <Clock size={14} aria-hidden="true" />
                {contact.hours}
              </span>
              <a href={contact.phoneHref} className="hcx-top-link text-slate-300 hover:text-white">
                <Phone size={14} aria-hidden="true" />
                {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`} className="hcx-top-link text-slate-300 hover:text-white">
                <Mail size={14} aria-hidden="true" />
                {contact.email}
              </a>
            </div>

            <NavLink
              to="/register/partner"
              className="hcx-top-link ml-auto font-medium text-slate-300 hover:text-white"
            >
              Are you a service professional?
              <span className="font-bold text-[#ff8a3d] ml-1.5">Join us</span>
            </NavLink>
          </div>
        </div>
      </div>

      {/* MAIN HEADER */}
      <div
        className={`relative overflow-hidden bg-white backdrop-blur-xl transition-all duration-300 ${
          scrolled ? "py-2 shadow-sm" : "py-3 border-b border-gray-100"
        }`}
      >
        <div
          className="relative mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center px-5 sm:px-6 md:grid-cols-[1fr_auto_1fr]"
        >
          {/* LOGO */}
          <NavLink
            to="/"
            onClick={closeMenu}
            aria-label="HomeCareX Home"
            className="flex items-center justify-self-start rounded-xl"
          >
            <img
              src="/logo.webp"
              alt="HomeCareX"
              width={326}
              height={128}
              fetchPriority="high"
              decoding="async"
              className="h-14 w-auto object-contain mix-blend-multiply transition-transform duration-300 hover:scale-105 sm:h-16"
            />
          </NavLink>

          {/* DESKTOP NAVIGATION */}
          <nav
            className="hcx-header-drop hidden items-center gap-8 md:flex"
            aria-label="Main navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `hcx-nav-link text-base transition-colors duration-200 ${
                    isActive ? "active font-bold text-[#0f172a]" : "font-medium text-slate-600 hover:text-[#0f172a]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* LOGIN BUTTON */}
          <div className="hcx-header-drop hidden justify-self-end md:block">
            <NavLink
              to="/login"
              className="hcx-login group inline-flex items-center gap-2 rounded-xl bg-[#ff8a3d] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5"
            >
              <span className="relative z-10">Login</span>
              <span
                className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              >
                →
              </span>
            </NavLink>
          </div>

          {/* MOBILE CONTROLS: Location Pill & Notification Bell */}
          <div className="flex md:hidden items-center justify-end gap-2">
            {/* Location Selector Pill */}
            <button
              type="button"
              onClick={() => setIsCityModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition-colors hover:bg-slate-100 active:scale-95"
              aria-label={`Current location: ${selectedCity}. Tap to change city.`}
            >
              <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[85px]">{selectedCity}</span>
              <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
            </button>

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotificationOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50/90 text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 active:scale-95"
              aria-label={unreadCount > 0 ? `View notifications (${unreadCount} unread)` : "View notifications"}
              data-testid="mobile-notification-bell"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <div id="mobile-navigation">
        <MobileDrawer
          isOpen={isMenuOpen}
          onClose={closeMenu}
          menuButtonRef={menuButtonRef}
        />
      </div>

      {/* CITY SELECTION MODAL */}
      {isCityModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsCityModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="City selection modal"
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] pb-[max(24px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Select Your City</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCityModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors active:scale-95"
                aria-label="Close city selector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-1 pr-0.5">
              {CITIES.map((c) => {
                const isSelected = selectedCity === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedCity(c.name);
                      try {
                        localStorage.setItem("hcx_city", c.name);
                      } catch {}
                      setIsCityModalOpen(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-95 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/80 text-blue-700 font-bold shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{c.state}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* NOTIFICATIONS MODAL / BOTTOM SHEET */}
      {isNotificationOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsNotificationOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Notifications sheet"
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] pb-[max(24px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                <h3 className="text-base font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                    {unreadCount} New
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    All caught up
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 active:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsNotificationOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors active:scale-95"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2.5 max-h-[60vh] overflow-y-auto py-1 pr-0.5">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`rounded-2xl border ${item.cardBorder} ${item.cardBg} p-3.5 transition-all cursor-pointer relative ${
                    item.read ? "opacity-85" : "shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                      )}
                      <span className={`text-xs font-bold leading-tight truncate ${item.titleColor}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold shrink-0 ${item.badgeColor || "bg-orange-100 text-orange-700"}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed font-normal">
                    {item.message}
                  </p>

                  {(item.couponCode || item.actionText) && (
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60">
                      {item.couponCode ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                            handleCopyCoupon(item.couponCode!);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-orange-400 bg-white px-2.5 py-1 text-[11px] font-bold text-orange-600 shadow-2xs hover:bg-orange-50 active:scale-95 transition-all"
                        >
                          <Tag className="h-3 w-3" />
                          <span>{copiedCoupon === item.couponCode ? "Copied! ✓" : `Code: ${item.couponCode}`}</span>
                        </button>
                      ) : <span />}

                      {item.actionText && item.actionUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                            setIsNotificationOpen(false);
                            navigate(item.actionUrl!);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 active:scale-95 transition-all"
                        >
                          <span>{item.actionText}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Header;
