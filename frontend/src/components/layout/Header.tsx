import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Clock, Mail, Phone } from "lucide-react";
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

const Header: React.FC = () => {
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

          {/* MOBILE MENU BUTTON */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((previous) => !previous)}
            className={`hcx-menu flex h-11 w-11 flex-col items-center justify-center gap-[5px] justify-self-end rounded-xl transition-colors duration-300 hover:bg-slate-100 md:hidden ${
              isMenuOpen ? "open bg-slate-100" : ""
            }`}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
          >
            <span className="hcx-menu-bar" />
            <span className="hcx-menu-bar" />
            <span className="hcx-menu-bar" />
          </button>
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
    </header>
  );
};

export default Header;
