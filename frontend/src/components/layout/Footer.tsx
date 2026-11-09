import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ROUTES } from "../../constants/routes";

/* =========================================================
   STYLES (same design tokens as the other HomeCareX pages)
   Indigo #4338ca = structure and text, Orange #ff8a3d = action
========================================================= */

const styles = `
.hcx-ft { font-family: 'DM Sans', system-ui, sans-serif; }
.hcx-ft h2, .hcx-ft h3, .hcx-ft .display {
  font-family: 'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif;
  letter-spacing: -0.01em;
}

@keyframes ft-drift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-24px) scale(1.08); } }
.ft-drift { animation: ft-drift 14s ease-in-out infinite; }

/* Columns fade up one after another once the footer is visible */
.ft-col { opacity: 0; transform: translateY(18px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
.ft-visible .ft-col { opacity: 1; transform: none; }

/* Link with a small orange dash that grows on hover */
.ft-link { position: relative; display: inline-block; padding-left: 0; color: #c9c8e6; transition: color .25s ease, padding-left .25s ease; }
.ft-link::before {
  content: ""; position: absolute; left: 0; top: 50%; height: 2px; width: 0; border-radius: 2px;
  background: #ff8a3d; transform: translateY(-50%); transition: width .25s ease;
}
.ft-link:hover, .ft-link.is-active { color: #ffffff; padding-left: 12px; }
.ft-link:hover::before, .ft-link.is-active::before { width: 8px; }

.hcx-ft a:focus-visible, .hcx-ft button:focus-visible { outline: 3px solid #ff8a3d; outline-offset: 3px; border-radius: 8px; }

@media (prefers-reduced-motion: reduce) {
  .hcx-ft *, .hcx-ft *::before, .hcx-ft *::after { animation: none !important; transition: none !important; }
  .ft-col { opacity: 1 !important; transform: none !important; }
}
`;

/* =========================================================
   DATA
========================================================= */

interface FooterLink {
  to: string;
  label: string;
}

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Company",
    links: [
      { to: "/", label: "Home" },
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
      { to: ROUTES.CAREERS, label: "Careers" },
    ],
  },
  {
    title: "Services",
    links: [
      { to: "/services/home-cleaning", label: "Home Cleaning" },
      { to: "/services/plumbing", label: "Plumbing" },
      { to: "/services/electrical", label: "Electrical" },
      { to: "/services/painting", label: "Painting" },
      { to: "/services/appliance-repair", label: "Appliance Repair" },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/faq", label: "FAQ" },
      { to: ROUTES.REVIEWS, label: "Customer Reviews" },
    ],
  },
];

/* Inline icons: no extra package needed */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const icons = {
  phone: (
    <svg {...iconProps} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  mail: (
    <svg {...iconProps} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
  pin: (
    <svg {...iconProps} className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  facebook: (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  instagram: (
    <svg {...iconProps} className="h-4 w-4">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  x: (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  ),
  linkedin: (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
};

const socials = [
  { label: "Facebook", href: "https://www.facebook.com/", icon: icons.facebook },
  { label: "Instagram", href: "https://www.instagram.com/", icon: icons.instagram },
  { label: "X", href: "https://x.com/", icon: icons.x },
  { label: "LinkedIn", href: "https://www.linkedin.com/", icon: icons.linkedin },
];

/* =========================================================
   COMPONENT
========================================================= */

const Footer: React.FC = () => {
  const { pathname } = useLocation();
  const footerRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Reveal the footer columns once, when the footer scrolls into view
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const delay = (n: number): React.CSSProperties => ({ transitionDelay: `${n * 80}ms` });

  return (
    <footer
      ref={footerRef}
      className={`hcx-ft relative isolate overflow-hidden bg-[#1e1b6e] text-white ${visible ? "ft-visible" : ""}`}
    >
      <style>{styles}</style>

      {/* Background glow */}
      <div className="ft-drift pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-[#ff8a3d]/15 blur-3xl" />
      <div
        className="ft-drift pointer-events-none absolute -bottom-40 -left-32 -z-10 h-96 w-96 rounded-full bg-[#4338ca]/40 blur-3xl"
        style={{ animationDelay: "-7s" }}
      />

      {/* Orange accent line on top */}
      <div className="h-1 w-full bg-gradient-to-r from-[#4338ca] via-[#ff8a3d] to-[#4338ca]" />

      <div className="mx-auto max-w-7xl px-3.5 sm:px-8 lg:px-10 pb-24 md:pb-7 pt-10 sm:pt-12">
        {/* ================= FOOTER CONTENT ================= */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-6 lg:gap-6">
          {/* ================= BRAND (LEFT SIDE - CLEAN WITHOUT CONTACT DETAILS) ================= */}
          <div className="ft-col md:col-span-2" style={delay(0)}>
            <NavLink
              to={pathname === "/" ? "/about" : "/"}
              aria-label={pathname === "/" ? "HomeCareX About" : "HomeCareX Home"}
              className="display inline-block text-2xl font-extrabold tracking-tight"
            >
              HOME<span className="text-[#ff8a3d]">CARE</span>X
            </NavLink>

            <p className="mt-1.5 text-xs sm:text-sm font-medium text-indigo-200">Your home, our care</p>

            <p className="mt-2.5 max-w-xs text-xs sm:text-sm leading-relaxed text-indigo-100/70">
              Reliable home services delivered with care, quality and professionalism.
            </p>
          </div>

          {/* ================= LINK COLUMNS (COMPANY, SERVICES, SUPPORT, CONTACT US) IN A ROW ON MOBILE ================= */}
          <div className="col-span-full grid grid-cols-[auto_auto_auto_1fr] gap-x-2.5 sm:grid-cols-4 sm:gap-x-6 md:contents">
            {columns.map((col, i) => (
              <nav key={col.title} className="ft-col min-w-0" style={delay(i + 1)} aria-label={col.title}>
                <h3 className="mb-2 sm:mb-3 text-[11px] sm:text-sm font-bold text-white tracking-tight">{col.title}</h3>
                <ul className="space-y-1.5 sm:space-y-2.5 text-[10px] sm:text-sm">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`} className="leading-snug">
                      <NavLink
                        to={link.to}
                        end={link.to === "/"}
                        className={({ isActive }) => `ft-link ${isActive ? "is-active" : ""}`}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            {/* ================= CONTACT US (4TH COLUMN IN THE SAME ROW) ================= */}
            <div className="ft-col min-w-0 md:col-span-1" style={delay(4)} aria-label="Contact Us">
              <h3 className="mb-2 sm:mb-3 text-[11px] sm:text-sm font-bold text-white tracking-tight">Contact Us</h3>
              <ul className="space-y-1.5 sm:space-y-2.5 text-[10px] sm:text-sm text-indigo-100">
                <li>
                  <a
                    href="tel:+919390212572"
                    className="group flex items-start gap-1 sm:gap-2 transition-colors duration-200 hover:text-white"
                  >
                    <span className="flex h-4 w-4 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ff8a3d] transition duration-200 group-hover:bg-[#ff8a3d] group-hover:text-[#1b1b3a] mt-0.5">
                      {icons.phone}
                    </span>
                    <span className="whitespace-nowrap sm:whitespace-normal leading-tight text-[9.5px] sm:text-sm">+91 9390212572</span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@homecarex.com"
                    className="group flex items-start gap-1 sm:gap-2 transition-colors duration-200 hover:text-white"
                  >
                    <span className="flex h-4 w-4 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ff8a3d] transition duration-200 group-hover:bg-[#ff8a3d] group-hover:text-[#1b1b3a] mt-0.5">
                      {icons.mail}
                    </span>
                    <span className="break-all sm:break-normal leading-tight text-[9.5px] sm:text-sm">support@homecarex.com</span>
                  </a>
                </li>
                <li className="flex items-center gap-1 sm:gap-2 text-indigo-100">
                  <span className="flex h-4 w-4 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ff8a3d]">
                    {icons.pin}
                  </span>
                  <span>India</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ================= BOTTOM BAR (MINIMAL - NO LINE DOWN FOLLOW US) ================= */}
        <div
          className="ft-col mt-8 border-t border-white/10 pt-5"
          style={delay(5)}
        >
          {/* Row 1: Follow Us & Back to Top IN THE SAME ROW ON MOBILE */}
          <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-semibold text-indigo-200 shrink-0">Follow us:</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/5 text-indigo-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ff8a3d] hover:text-[#1b1b3a]"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={scrollToTop}
              className="group inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-white/5 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-indigo-200 transition-all duration-200 hover:bg-[#ff8a3d] hover:text-[#1b1b3a] shrink-0"
              aria-label="Scroll back to top"
            >
              <span>Back to top</span>
              <span className="transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden>
                ↑
              </span>
            </button>
          </div>

          {/* Row 2: Copyright & Legal Links (Cleanly separated without any horizontal line) */}
          <div className="mt-3.5 flex flex-col items-center justify-between gap-2.5 text-xs text-indigo-200/60 sm:flex-row">
            <p>© 2026 HomeCareX. All rights reserved.</p>

            <div className="flex items-center gap-4">
              <NavLink to={ROUTES.PRIVACY} className="hover:text-white transition-colors">Privacy Policy</NavLink>
              <span className="text-white/20">•</span>
              <NavLink to={ROUTES.TERMS} className="hover:text-white transition-colors">Terms &amp; Conditions</NavLink>
              <span className="text-white/20">•</span>
              <NavLink to={ROUTES.COOKIES} className="hover:text-white transition-colors">Cookie Policy</NavLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;