import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import HeroSearch from "../../../components/public/HeroSearch";
import MobileHome from "./MobileHome";
import CategoryCard, { BroomIcon, FaucetIcon } from "../../../components/public/CategoryCard";
import Seo from "../../../components/common/Seo";
import OptimizedImage from "../../../components/common/OptimizedImage";
import { organizationLd, websiteLd } from "../../../lib/jsonld";
import {
  Home as HomeIcon,
  ShieldCheck,
  Clock,
  Headphones,
  ThumbsUp,
  LayoutGrid,
  ArrowRight,
  Snowflake,
  Wrench,
  Zap,
} from "lucide-react";

// Below-the-fold sections load in separate chunks so they do not block the first paint.
const TrustStrip = lazy(() => import("../../../components/public/TrustStrip"));
const Testimonials = lazy(() => import("../../../components/public/Testimonials"));
const StatsStrip = lazy(() => import("../../../components/public/StatsStrip"));

/* =========================================================
   DESIGN TOKENS
========================================================= */

const styles = `
.hcx {
  --indigo: #4338ca;
  --indigo-deep: #1e1b6e;
  --indigo-tint: #eef0ff;
  --orange: #ff8a3d;
  --orange-tint: #fff3ea;
  --ink: #1b1b3a;
  --muted: #5b5b7a;
  font-family: 'Manrope', system-ui, sans-serif;
  color: var(--ink);
}
.hcx h1, .hcx h2, .hcx h3, .hcx .display {
  font-family: 'Poppins', 'Manrope', system-ui, sans-serif;
  letter-spacing: -0.02em;
}

/* --- Hero & Entry animations --- */
@keyframes hcx-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes hcx-draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.hcx-in   { opacity: 0; animation: hcx-fade .5s cubic-bezier(.2,.7,.2,1) forwards; }

/* --- Smooth Floating & Ambient Animations --- */
@keyframes hcx-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-7px) rotate(0.4deg); }
}
@keyframes hcx-float-delayed {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(7px) rotate(-0.4deg); }
}
@keyframes hcx-pulse-ambient {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.05); }
}
@keyframes hcx-pulse-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.95; }
}

.hcx-float-badge {
  animation: hcx-float 6s ease-in-out infinite;
}
.hcx-float-badge-delayed {
  animation: hcx-float-delayed 7s ease-in-out 1s infinite;
}
.hcx-pulse-ambient {
  animation: hcx-pulse-ambient 10s ease-in-out infinite;
}
.hcx-pulse-glow {
  animation: hcx-pulse-glow 3s ease-in-out infinite;
}

/* --- Scroll reveal --- */
.hcx-reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1); }
.hcx-reveal.is-in { opacity: 1; transform: none; }

/* --- Process line draws itself --- */
.hcx-line { transform: scaleX(0); transform-origin: left; }
.is-in .hcx-line, .hcx-line.is-in { animation: hcx-draw 1.4s cubic-bezier(.65,0,.2,1) .2s forwards; }

/* --- FAQ smooth open --- */
.hcx-acc { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.2,.7,.2,1); }
.hcx-acc.open { grid-template-rows: 1fr; }
.hcx-acc > div { overflow: hidden; }

/* --- Marquee ticker --- */
@keyframes hcx-marquee { to { transform: translateX(-50%); } }
.hcx-marquee { animation: hcx-marquee 38s linear infinite; }
.hcx-marquee-wrap:hover .hcx-marquee { animation-play-state: paused; }

/* --- Card luxury hover shine --- */
.hcx-card-shine {
  position: relative;
  overflow: hidden;
}
.hcx-card-shine::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    60deg,
    transparent 35%,
    rgba(255, 255, 255, 0.4) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    transparent 55%
  );
  transform: translateX(-100%);
  transition: transform 0.8s ease;
  pointer-events: none;
}
.hcx-card-shine:hover::after {
  transform: translateX(100%);
}

/* --- Below-the-fold content visibility --- */
.hcx-cv { content-visibility: auto; contain-intrinsic-size: auto 800px; }

/* --- Focus + motion safety --- */
.hcx a:focus-visible, .hcx button:focus-visible { outline: 3px solid var(--orange); outline-offset: 3px; border-radius: 10px; }
@media (prefers-reduced-motion: reduce) {
  .hcx *, .hcx *::before, .hcx *::after { animation: none !important; transition: none !important; }
  .hcx-in, .hcx-reveal { opacity: 1 !important; transform: none !important; clip-path: none !important; }
  .hcx-line { transform: none !important; }
}
`;

/* =========================================================
   DATA
========================================================= */

const popularCategoriesData = [
  {
    id: "home-cleaning",
    name: "Home Cleaning",
    description: "Professional cleaning to keep your home fresh, hygienic and spotless.",
    image: "/images/home-cleaning.webp",
    link: "/services?category=home-cleaning",
  },
  {
    id: "plumbing",
    name: "Plumbing Services",
    description: "Reliable help with leaks, repairs, installations and maintenance.",
    image: "/images/plumbing-1200.webp",
    link: "/services?category=electrical-plumbing&q=plumbing",
  },
  {
    id: "electrical",
    name: "Electrical Services",
    description: "Safe, professional electrical work for every room in your home.",
    image: "/images/electrical.webp",
    link: "/services?category=electrical-plumbing&q=electrical",
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    description: "Quick, dependable repairs for your household appliances.",
    image: "/images/appliance-repair.webp",
    link: "/services?category=appliance-repair-service",
  },
];

const allServicesData = [
  {
    id: "deep-home-cleaning",
    title: "Home Cleaning",
    icon: <BroomIcon className="h-4 w-4 text-blue-500" />,
    badgeColor: "bg-blue-50 text-blue-500",
    description: "Professional cleaning to keep your home fresh, hygienic and comfortable.",
    image: "/images/home-cleaning.webp",
    link: "/services/deep-home-cleaning",
  },
  {
    id: "plumbing-tap-leak-repair",
    title: "Plumbing Services",
    icon: <FaucetIcon className="h-4 w-4 text-blue-500" />,
    badgeColor: "bg-blue-50 text-blue-500",
    description: "Reliable help with leaks, repairs, installations and maintenance.",
    image: "/images/plumbing-1200.webp",
    link: "/services/plumbing-tap-leak-repair",
  },
  {
    id: "electrician-visit-general",
    title: "Electrical Services",
    icon: <Zap className="h-4 w-4 text-amber-500" />,
    badgeColor: "bg-amber-50 text-amber-500",
    description: "Safe, professional electrical work for every room in your home.",
    image: "/images/electrical.webp",
    link: "/services/electrician-visit-general",
  },
  {
    id: "washing-machine-repair",
    title: "Appliance Repair",
    icon: <Wrench className="h-4 w-4 text-emerald-500" />,
    badgeColor: "bg-emerald-50 text-emerald-500",
    description: "Quick, dependable repairs for your household appliances.",
    image: "/images/washing-machine-repair.webp",
    link: "/services/washing-machine-repair",
  },
  {
    id: "ac-service-gas-refill",
    title: "AC Service",
    icon: <Snowflake className="h-4 w-4 text-purple-600" />,
    badgeColor: "bg-purple-50 text-purple-600",
    description: "Installation, repair and maintenance for cooling comfort.",
    image: "/images/background.webp",
    link: "/services/ac-service-gas-refill",
  },
  {
    id: "furniture-assembly",
    title: "Handyman Services",
    icon: <HomeIcon className="h-4 w-4 text-orange-500" />,
    badgeColor: "bg-orange-50 text-orange-500",
    description: "General repairs and maintenance for your everyday home needs.",
    image: "/images/home-maintenance.webp",
    link: "/services/furniture-assembly",
  },
];

const marqueeServices = [
  { title: "Home Cleaning", icon: "✨", link: "/services?category=home-cleaning" },
  { title: "Plumbing Services", icon: "🔧", link: "/services?category=electrical-plumbing&q=plumbing" },
  { title: "Electrical Services", icon: "⚡", link: "/services?category=electrical-plumbing&q=electrical" },
  { title: "Appliance Repair", icon: "🛠️", link: "/services?category=appliance-repair-service" },
  { title: "AC Service", icon: "❄️", link: "/services/ac-service-gas-refill" },
  { title: "Handyman Services", icon: "🏠", link: "/services?category=carpentry-furniture-assembly" },
];

const steps = [
  { title: "Choose a service", text: "Select the home service you need from our verified catalog." },
  { title: "Schedule a time", text: "Pick your preferred date, time slot and provide your address." },
  { title: "Expert arrives", text: "A trained professional arrives promptly and completes the job." },
  { title: "Pay with ease", text: "Inspect the completed work and pay securely with transparent rates." },
];

const faqs = [
  { question: "What services does HomeCareX provide?", answer: "HomeCareX provides home cleaning, plumbing, electrical services, appliance repair, AC service, and handyman maintenance." },
  { question: "How can I book a service?", answer: "Browse the services on HomeCareX, select the one you need, enter your pincode and continue with the simple service request process." },
  { question: "Can I choose a specific service?", answer: "Yes. You can select the exact home service and time slot you require." },
  { question: "How do I contact HomeCareX?", answer: "Use the Contact page on the website or reach our 24/7 support and we will assist you immediately." },
  { question: "Is regular maintenance available?", answer: "Yes. Home maintenance services help keep your home safe and comfortable all year." },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

/* =========================================================
   BACKGROUND & HELPER COMPONENTS
========================================================= */

const ModernPeachAura: React.FC = () => (
  <div
    className="pointer-events-none absolute -left-20 -top-24 w-[420px] sm:w-[560px] md:w-[680px] select-none"
    aria-hidden="true"
  >
    {/* Soft warm sunset aura glow */}
    <div className="absolute -left-10 -top-10 h-80 w-80 sm:h-[420px] sm:w-[420px] rounded-full bg-gradient-to-tr from-orange-200/25 via-amber-100/30 to-transparent blur-3xl hcx-pulse-ambient" />

    <svg
      className="w-full h-auto text-orange-400"
      viewBox="0 0 600 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hcxPeachGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="60%" stopColor="#fdba74" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffedd5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hcxPeachFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff7ed" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft warm inner radial fill */}
      <circle cx="80" cy="80" r="380" fill="url(#hcxPeachFill)" />

      {/* Sleek architectural harmonic contour arcs */}
      <circle cx="80" cy="80" r="380" stroke="url(#hcxPeachGrad)" strokeWidth="2" strokeDasharray="8 6" />
      <circle cx="80" cy="80" r="340" stroke="url(#hcxPeachGrad)" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="80" cy="80" r="420" stroke="url(#hcxPeachGrad)" strokeWidth="1" strokeOpacity="0.4" />

      {/* Subtle guide ticks */}
      <line x1="80" y1="450" x2="80" y2="470" stroke="#f97316" strokeOpacity="0.2" strokeWidth="1.5" />
      <line x1="450" y1="80" x2="470" y2="80" stroke="#f97316" strokeOpacity="0.2" strokeWidth="1.5" />
    </svg>
  </div>
);

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = "",
}) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hcx-reveal ${seen ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const Marquee: React.FC = () => (
  <div
    className="hcx-marquee-wrap relative z-20 overflow-hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-sm py-2.5 sm:py-3 shadow-xs"
  >
    {/* Left & right edge gradient fades */}
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20 bg-gradient-to-r from-white via-white/80 to-transparent" />
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20 bg-gradient-to-l from-white via-white/80 to-transparent" />

    <div className="hcx-marquee flex w-max items-center gap-10">
      {[...marqueeServices, ...marqueeServices, ...marqueeServices, ...marqueeServices].map((s, i) => (
        <Link
          key={i}
          to={s.link}
          className="inline-flex items-center gap-2.5 whitespace-nowrap text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#f97316] transition-colors"
        >
          <span className="text-base sm:text-lg">{s.icon}</span>
          <span className="text-slate-800 hover:text-[#f97316]">{s.title}</span>
          <span className="ml-7 inline-block h-1.5 w-1.5 rounded-full bg-[#f97316]" />
        </Link>
      ))}
    </div>
  </div>
);

const SectionHead: React.FC<{ title: React.ReactNode; text?: string; eyebrow?: string }> = ({ title, text, eyebrow }) => (
  <Reveal className="mx-auto mb-6 sm:mb-7 max-w-2xl text-center">
    {eyebrow && (
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-600 ring-1 ring-blue-500/15 shadow-2xs">
        <span>⚡</span>
        <span>{eyebrow}</span>
      </div>
    )}
    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight leading-tight">
      {title}
    </h2>
    {text && <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-500">{text}</p>}
  </Reveal>
);

/* =========================================================
   MAIN HOME COMPONENT
========================================================= */

const Home: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [processRef, processSeen] = useInView<HTMLDivElement>(0.3);
  const faqButtons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const removeShell = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.getElementById("hcx-shell")?.remove())
      );
    };
    const img = document.querySelector<HTMLImageElement>("img.hcx-hero-img");
    if (!img || (img.complete && img.naturalWidth > 0)) {
      removeShell();
      return undefined;
    }
    img.addEventListener("load", removeShell, { once: true });
    img.addEventListener("error", removeShell, { once: true });
    return () => {
      img.removeEventListener("load", removeShell);
      img.removeEventListener("error", removeShell);
    };
  }, []);

  const handleFaqKeys = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = faqs.length - 1;
    let next = -1;
    if (e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next >= 0) {
      e.preventDefault();
      faqButtons.current[next]?.focus();
    }
  };

  return (
    <div className="hcx overflow-x-hidden bg-white">
      <Seo
        title="HomeCareX | Trusted Home Services"
        description="Book trusted home cleaning, plumbing, electrical, appliance repair and maintenance services with HomeCareX."
        jsonLd={[organizationLd(), websiteLd()]}
      />

      <style>{styles}</style>

      {/* ================= MOBILE VIEW (EXACT NATIVE APP EXPERIENCE FROM DESIGN) ================= */}
      <MobileHome />

      {/* ================= DESKTOP VIEW (PRESERVED FULL SECTIONS) ================= */}
      <div className="hidden md:block">
      {/* ================= HERO (IMAGE 2) ================= */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-[#f0f4fa] via-[#f7f9fd] to-[#f4f7fb] pt-5 pb-8 sm:pt-7 sm:pb-10 lg:pt-8 lg:pb-10 xl:pt-10 xl:pb-12">
        {/* Subtle decorative glow for depth */}
        <div className="absolute -top-24 left-1/4 -z-10 h-80 w-80 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-1/3 left-10 -z-10 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl pointer-events-none" aria-hidden="true" />

        {/* Right side technician photo */}
        <div className="absolute inset-y-0 right-0 hidden lg:block w-[46%] pointer-events-none overflow-hidden">
          <picture>
            <source
              type="image/webp"
              srcSet="/images/background-800.webp 800w, /images/background-1280.webp 1280w, /images/background.webp 1672w"
              sizes="50vw"
            />
            <OptimizedImage
              src="/images/background.webp"
              alt="HomeCareX professional servicing AC unit in living room"
              width={1200}
              height={800}
              priority
              className="hcx-hero-img h-full w-full object-cover object-right"
            />
          </picture>
          <div className="absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-[#f7f9fd] to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f4f7fb] to-transparent pointer-events-none" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl xl:max-w-3xl">
            {/* Peach Pill Badge */}
            <Reveal delay={0}>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff3ea] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#f97316] ring-1 ring-[#f97316]/20 shadow-xs">
                <HomeIcon className="h-4 w-4 text-[#f97316]" />
                <span>Your home, our care</span>
              </div>
            </Reveal>

            {/* Main Title */}
            <Reveal delay={60}>
              <h1 className="mt-3 sm:mt-4 text-3xl font-extrabold tracking-tight text-[#0f172a] sm:text-4xl lg:text-[2.65rem] xl:text-[2.95rem] leading-[1.14]">
                Professional home<br />
                services <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">at your doorstep</span>
              </h1>
            </Reveal>

            {/* Subtitle */}
            <Reveal delay={120}>
              <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                Book trusted professionals for cleaning, plumbing, electrical work, AC service and more — all in one place.
              </p>
            </Reveal>

            {/* Search Box Card */}
            <Reveal delay={160}>
              <div className="mt-4 sm:mt-5 w-full max-w-2xl rounded-2xl bg-white p-3 sm:p-4 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.08)] border border-slate-100 ring-1 ring-slate-900/5">
                <HeroSearch />
              </div>
            </Reveal>

            {/* Trust Badges below search box - Clean, Professional & Borderless */}
            <Reveal delay={200}>
              <div className="mt-5 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-3xl xl:max-w-4xl">
                {/* Verified Professionals */}
                <div className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-100/80 text-blue-600 transition-transform duration-200 group-hover:scale-105">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">Verified Professionals</div>
                    <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Trained &amp; trusted</div>
                  </div>
                </div>

                {/* On-time Service */}
                <div className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-full bg-orange-100/80 text-[#f97316] transition-transform duration-200 group-hover:scale-105">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">On-time Service</div>
                    <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Your time matters</div>
                  </div>
                </div>

                {/* Transparent Pricing */}
                <div className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 transition-transform duration-200 group-hover:scale-105">
                    <span className="text-base sm:text-lg font-bold">₹</span>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">Transparent Pricing</div>
                    <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">No hidden charges</div>
                  </div>
                </div>

                {/* Dedicated Support */}
                <div className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-full bg-purple-100/80 text-purple-600 transition-transform duration-200 group-hover:scale-105">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">Dedicated Support</div>
                    <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Always here to help</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= MARQUEE TICKER (AFTER HERO) ================= */}
      <Marquee />

      {/* ================= POPULAR CATEGORIES (IMAGE 1) ================= */}
      <section
        id="categories"
        aria-labelledby="categories-heading"
        className="relative overflow-hidden bg-white py-8 sm:py-10"
      >
        {/* Subtle modern ambient lighting */}
        <div className="pointer-events-none absolute -top-24 right-1/4 -z-10 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl hcx-pulse-ambient" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-10 -z-10 h-72 w-72 rounded-full bg-indigo-50/40 blur-3xl hcx-pulse-ambient" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          {/* Badge & Heading Row */}
          <Reveal>
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-600 ring-1 ring-blue-500/15">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Our Services</span>
            </div>

            <div className="mb-6 sm:mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2
                id="categories-heading"
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight leading-tight"
              >
                Popular <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff7a22] bg-clip-text text-transparent">categories</span>
              </h2>
                <p className="mt-1.5 text-sm sm:text-base text-slate-500 leading-relaxed">
                  Explore our most requested home services and find the right professional for your needs.
                </p>
              </div>

              <Link
                to="/services"
                className="group inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-blue-500 bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-blue-600 shadow-xs transition-all duration-300 hover:bg-blue-600 hover:text-white hover:shadow-md hover:-translate-y-0.5"
              >
                <span>Browse all services</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          {/* 4 Category Cards with Staggered Scroll Reveal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularCategoriesData.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <CategoryCard
                  id={c.id}
                  name={c.name}
                  description={c.description}
                  image={c.image}
                  link={c.link}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SERVICES (IMAGE 3) ================= */}
      <section id="services" className="relative scroll-mt-16 bg-[#f8faff] py-8 sm:py-10 overflow-hidden">
        <ModernPeachAura />
        {/* Soft atmospheric ambient glow */}
        <div className="pointer-events-none absolute -top-16 right-0 sm:right-10 md:right-16 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-gradient-to-bl from-blue-100/40 via-indigo-50/25 to-transparent blur-3xl hcx-pulse-ambient" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          {/* Centered Heading */}
          <Reveal>
            <div className="text-center max-w-3xl mx-auto">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-0.5 text-xs font-semibold text-[#f97316] ring-1 ring-[#f97316]/20 shadow-xs">
                <span>✨</span>
                <span>Complete Home Solutions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight leading-tight">
                Everything your <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">home needs</span>
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-slate-500 leading-relaxed">
                Professional home services delivered with convenience, reliability and care.
              </p>
            </div>
          </Reveal>

          {/* 3 Trust Badges in a Row */}
          <Reveal delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-5 mb-7 sm:mb-8">
              {/* Verified Professionals */}
              <div className="flex items-center gap-3 group px-3 py-1.5 rounded-2xl hover:bg-white/70 transition-all duration-200 cursor-default">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100/80 text-blue-600 shadow-xs transition-transform duration-300 group-hover:scale-110">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">Verified Professionals</div>
                  <div className="text-xs text-slate-500 mt-0.5">Trained &amp; trusted</div>
                </div>
              </div>

              {/* On-time Service */}
              <div className="flex items-center gap-3 group px-3 py-1.5 rounded-2xl hover:bg-white/70 transition-all duration-200 cursor-default">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100/80 text-[#ff8a3d] shadow-xs transition-transform duration-300 group-hover:scale-110">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">On-time Service</div>
                  <div className="text-xs text-slate-500 mt-0.5">Your time matters</div>
                </div>
              </div>

              {/* Quality Work */}
              <div className="flex items-center gap-3 group px-3 py-1.5 rounded-2xl hover:bg-white/70 transition-all duration-200 cursor-default">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100/80 text-blue-600 shadow-xs transition-transform duration-300 group-hover:scale-110">
                  <ThumbsUp className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">Quality Work</div>
                  <div className="text-xs text-slate-500 mt-0.5">100% satisfaction</div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 6 Services Cards (3 cols x 2 rows) with Staggered Scroll Reveal */}
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allServicesData.map((s, i) => (
              <Reveal key={s.id} delay={i * 70}>
                <Link
                  to={s.link}
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-blue-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {/* Photo with rounded top */}
                  <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={s.image}
                      alt={s.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-106"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>

                  {/* Content - Compact & Minimal without wasted space */}
                  <div className="p-4 sm:p-5 flex flex-col bg-white">
                    {/* Icon Badge */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 shadow-xs transition-transform duration-300 group-hover:scale-110 ${s.badgeColor}`}>
                      {s.icon}
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:text-blue-600">
                      {s.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2">
                      {s.description}
                    </p>

                    {/* Clean Minimal Bottom Action */}
                    <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <span className="text-xs font-semibold text-blue-600 transition-colors group-hover:text-blue-700">
                        Book service
                      </span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:translate-x-1 shadow-xs"
                        aria-hidden="true"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHY CHOOSE US ================= */}
      <Suspense fallback={<div style={{ minHeight: 480 }} aria-hidden />}>
        <TrustStrip />
      </Suspense>

      {/* ================= PROCESS ================= */}
      <section className="hcx-cv relative overflow-hidden bg-gradient-to-b from-[#f8faff] via-white to-[#f8faff] py-8 sm:py-10 border-y border-slate-100">
        {/* Subtle luminous ambient glows */}
        <div className="pointer-events-none absolute -top-20 left-1/4 -z-10 h-72 w-72 rounded-full bg-blue-100/40 blur-3xl hcx-pulse-ambient" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 -z-10 h-72 w-72 rounded-full bg-orange-100/35 blur-3xl hcx-pulse-ambient" aria-hidden="true" />

        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHead
            eyebrow="Simple 4-Step Process"
            title={<>How HomeCareX <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Works</span></>}
            text="Four steps from request to a job well done."
          />

          <div ref={processRef} className={`relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 pt-2 ${processSeen ? "is-in" : ""}`}>
            {/* Connecting progress track line on desktop */}
            <div className="absolute left-[12.5%] right-[12.5%] top-9 hidden h-1 bg-gradient-to-r from-blue-200 via-indigo-200 to-orange-200 lg:block rounded-full opacity-60" aria-hidden="true">
              <div className="hcx-line h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-[#ff8a3d] rounded-full" />
            </div>

            {steps.map((s, i) => {
              const stepPalette = [
                {
                  badge: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)] ring-8 ring-white",
                  number: "01",
                },
                {
                  badge: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] ring-8 ring-white",
                  number: "02",
                },
                {
                  badge: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_8px_20px_rgba(147,51,234,0.3)] ring-8 ring-white",
                  number: "03",
                },
                {
                  badge: "bg-gradient-to-br from-[#ff8a3d] to-[#f97316] text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)] ring-8 ring-white",
                  number: "04",
                },
              ][i];

              return (
                <Reveal key={s.title} delay={i * 120} className="relative">
                  <div className="group relative flex flex-col items-center text-center px-2 sm:px-4 py-2 transition-transform duration-300 hover:-translate-y-1">
                    {/* Vibrant Step Badge */}
                    <div
                      className={`display relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-extrabold transition-transform duration-300 group-hover:scale-110 ${stepPalette.badge}`}
                    >
                      {stepPalette.number}
                    </div>

                    {/* Step Title */}
                    <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {s.title}
                    </h3>

                    {/* Step Description: revealed on hover */}
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out overflow-hidden">
                      <div className="overflow-hidden">
                        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500 max-w-[220px] mx-auto pt-0.5">
                          {s.text}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" aria-labelledby="faq-heading" className="hcx-cv relative overflow-hidden bg-gradient-to-b from-[#f8faff] via-white to-[#f4f7fd] py-8 sm:py-10 border-t border-slate-100">
        {faqs.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(faqSchema),
            }}
          />
        )}

        <div
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#ff8a3d]/15 to-amber-200/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-28 bottom-10 h-72 w-72 rounded-full bg-gradient-to-tr from-[#4338ca]/10 to-blue-200/20 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-3.5 py-1 text-xs font-bold text-orange-800 ring-1 ring-orange-200/70 shadow-xs">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#ff8a3d] animate-pulse" />
                  <span>Got Questions?</span>
                </div>
                <h2
                  id="faq-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight"
                >
                  Frequently Asked <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Questions</span>
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm font-normal">
                  Everything you need to know about HomeCareX services, verified pros, and transparent pricing.
                </p>
              </Reveal>

              <Reveal delay={120}>
                {/* Clean Vibrant Card for "Still have questions?" */}
                <div className="relative mt-6 sm:mt-8 overflow-hidden rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-[0_10px_30px_-15px_rgba(30,27,110,0.08)] transition-all duration-300 hover:shadow-md hover:border-orange-200/80">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-indigo-600" />
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ff8a3d] ring-1 ring-orange-200/60 shadow-2xs">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#1e1b6e] leading-snug">Still have questions?</h3>
                      <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Support Available
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-600">
                    Can&apos;t find what you are looking for? Our friendly care team is always here to help you out.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                      to="/contact"
                      className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] px-4 py-2 sm:px-5 sm:py-2.5 font-bold text-xs sm:text-sm text-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span>Contact Support</span>
                      <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>→</span>
                    </Link>
                    <span className="text-[11px] font-medium text-slate-400">
                      Reply in ~5 mins
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="space-y-3">
              {faqs.map((f, i) => {
                const open = openFaq === i;
                return (
                  <Reveal key={f.question} delay={i * 60}>
                    <div
                      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
                        open
                          ? "bg-white border-2 border-orange-200/90 shadow-[0_8px_25px_-10px_rgba(255,138,61,0.2)]"
                          : "bg-white border border-slate-200/80 shadow-2xs hover:border-indigo-200 hover:shadow-xs"
                      }`}
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-gradient-to-b from-[#ff8a3d] to-[#f97316] transition-transform duration-300 ${
                          open ? "scale-y-100" : "scale-y-0"
                        }`}
                        aria-hidden
                      />

                      <h3>
                        <button
                          type="button"
                          ref={(el) => {
                            faqButtons.current[i] = el;
                          }}
                          onClick={() => setOpenFaq(open ? null : i)}
                          onKeyDown={(e) => handleFaqKeys(e, i)}
                          aria-expanded={open}
                          aria-controls={`faq-panel-${i}`}
                          id={`faq-btn-${i}`}
                          className="group flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-6 sm:py-4 text-left transition-colors"
                        >
                          <span
                            className={`text-sm sm:text-base font-bold transition-colors duration-200 ${
                              open ? "text-[#1e1b6e] font-extrabold" : "text-[#1e1b6e] group-hover:text-[#ff8a3d]"
                            }`}
                          >
                            {f.question}
                          </span>
                          <span
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                              open
                                ? "rotate-45 bg-gradient-to-r from-[#ff8a3d] to-[#f97316] text-white shadow-xs scale-105"
                                : "bg-slate-100 text-slate-500 group-hover:bg-orange-50 group-hover:text-[#ff8a3d]"
                            }`}
                            aria-hidden
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </span>
                        </button>
                      </h3>

                      <div
                        id={`faq-panel-${i}`}
                        role="region"
                        aria-labelledby={`faq-btn-${i}`}
                        className={`hcx-acc ${open ? "open" : ""}`}
                      >
                        <div>
                          <div className="border-t border-slate-100/90 mx-5 sm:mx-6 pt-2.5 pb-4">
                            <p className="text-xs sm:text-sm leading-relaxed text-slate-600 font-normal">
                              {f.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div style={{ minHeight: 600 }} aria-hidden />}>
        <Testimonials />
        <StatsStrip />
      </Suspense>

      {/* ================= FINAL CALL TO ACTION ================= */}
      <section className="hcx-cv bg-white px-6 pt-3 pb-7 sm:pt-4 sm:pb-9">
        <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6 md:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl bg-[#eef0ff] p-6 sm:p-7 ring-1 ring-[#4338ca]/10 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4338ca] text-white shadow-xs" aria-hidden="true">
                <HomeIcon className="h-5 w-5" />
              </span>
              <h2 className="mt-3.5 text-xl sm:text-2xl font-bold leading-snug text-[#1e1b6e]">
                Need help with your <span className="bg-gradient-to-r from-[#ff8a3d] to-[#f97316] bg-clip-text text-transparent">home?</span>
              </h2>
              <p className="mt-2 flex-1 text-sm sm:text-base leading-relaxed text-[#5b5b7a]">
                Find reliable home services and make home maintenance simple and convenient.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/services"
                  className="rounded-xl bg-[#ff8a3d] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:bg-[#ff7a22]"
                >
                  Explore services
                </Link>
                <Link
                  to="/contact"
                  className="rounded-xl border-2 border-[#4338ca] px-5 py-2.5 text-sm font-bold text-[#4338ca] transition duration-200 hover:-translate-y-0.5 hover:bg-[#4338ca] hover:text-white"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-2xl bg-[#fff3ea] p-6 sm:p-7 ring-1 ring-[#ff8a3d]/25 shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff8a3d] text-white shadow-xs" aria-hidden="true">
                <Wrench className="h-5 w-5" />
              </span>
              <h2 className="mt-3.5 text-xl sm:text-2xl font-bold leading-snug text-[#1e1b6e]">
                Are you a service <span className="bg-gradient-to-r from-[#4338ca] to-[#6366f1] bg-clip-text text-transparent">professional?</span>
              </h2>
              <p className="mt-2 flex-1 text-sm sm:text-base leading-relaxed text-[#5b5b7a]">
                Join HomeCareX and connect with customers who are looking for your skills.
              </p>
              <div className="mt-5">
                <Link
                  to="/register/partner"
                  className="group inline-flex items-center gap-2 rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#1e1b6e]"
                >
                  <span>Join as a professional</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      </div>
    </div>
  );
};

export default Home;
