import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  Search,
  Calendar,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Award,
  Check,
  Layers,
  HelpCircle,
  MessageSquare,
  Lock,
  Sliders,
  TrendingUp,
  Compass,
  Target,
  Scale,
  Laptop,
  Settings,
  Headphones,
  Wrench,
  Zap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { aboutData } from "../../../content/about";
import { ROUTES } from "../../../constants/routes";
import { publicStyles } from "../../../components/public/PublicPageBackground";

/* =========================================================
   SCROLL REVEAL HELPER
========================================================= */

function useInView<T extends HTMLElement>(threshold = 0.1) {
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
      { threshold, rootMargin: "0px 0px -30px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = "" }) => {
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

const SectionHead: React.FC<{
  id?: string;
  eyebrow?: string;
  title: string;
  text?: string;
  centered?: boolean;
  eyebrowClassName?: string;
  titleClassName?: string;
  textClassName?: string;
}> = ({
  id,
  eyebrow,
  title,
  text,
  centered = true,
  eyebrowClassName = "",
  titleClassName = "",
  textClassName = "",
}) => (
  <Reveal className={`mb-5 sm:mb-6 max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
    {eyebrow && (
      <div className="mb-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 px-3 py-0.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-2xs ${eyebrowClassName}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" aria-hidden="true" />
          {eyebrow}
        </span>
      </div>
    )}
    <h2
      id={id}
      className={`text-2xl font-black text-slate-900 tracking-tight sm:text-3xl lg:text-4xl ${titleClassName}`}
    >
      {title}
    </h2>
    {text && (
      <p className={`mt-2 text-sm leading-relaxed text-slate-600 sm:text-base sm:leading-7 ${textClassName}`}>
        {text}
      </p>
    )}
  </Reveal>
);

/* =========================================================
   ABOUT PAGE COMPONENT
========================================================= */

const AboutPage: React.FC = () => {
  const {
    hero,
    story,
    whatWeDo,
    mission,
    vision,
    trust,
    quality,
    team,
    values,
    howItWorks,
    cta,
  } = aboutData;

  /* ---------------------------------------------------------
     MOBILE INTERACTIVE STATE (Carousels, Switches, Dropdowns)
  --------------------------------------------------------- */
  // Mobile Featured Services Carousel
  const [activeServiceSlide, setActiveServiceSlide] = useState(0);
  const serviceTouchStartX = useRef<number | null>(null);

  // Mobile Mission & Vision Segmented Switch
  const [activeMissionVisionTab, setActiveMissionVisionTab] = useState<"mission" | "vision">("mission");
  const missionVisionTouchStartX = useRef<number | null>(null);

  // Mobile Trust & Safety Carousel
  const [activeTrustSlide, setActiveTrustSlide] = useState(0);
  const trustTouchStartX = useRef<number | null>(null);

  // Mobile Core Values Carousel
  const [activeValueSlide, setActiveValueSlide] = useState(0);
  const valueTouchStartX = useRef<number | null>(null);

  // Mobile Accordion/Dropdown states
  const [expandedChallenge, setExpandedChallenge] = useState<number | null>(0);
  const [expandedQualityStep, setExpandedQualityStep] = useState<number | null>(0);
  const [expandedTeamDiscipline, setExpandedTeamDiscipline] = useState<string | null>(team.disciplines[0]?.id || null);
  const [expandedConnectStep, setExpandedConnectStep] = useState<number | null>(0);

  // Auto-advance Featured Services Carousel on mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveServiceSlide((prev) => (prev + 1) % whatWeDo.services.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [whatWeDo.services.length]);

  // Auto-advance Values Carousel on mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveValueSlide((prev) => (prev + 1) % values.items.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [values.items.length]);

  // Auto-advance Trust Carousel on mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTrustSlide((prev) => (prev + 1) % trust.practices.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [trust.practices.length]);

  useEffect(() => {
    document.title = "About HomeCareX | Home Services Made Simpler";

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Learn about HomeCareX, our mission, vision, and how our digital home-services marketplace connects customers with verified service partners."
    );
  }, []);

  return (
    <div className="hcx overflow-x-hidden bg-white text-slate-800 antialiased">
      <style>{publicStyles}</style>

      {/* =========================================================
          1. HERO SECTION
          ========================================================= */}
      <section
        aria-labelledby="about-hero-title"
        className="relative isolate overflow-hidden bg-gradient-to-b from-[#f0f4fa] via-[#f7f9fd] to-white pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-14 lg:pb-16 border-b border-slate-100"
      >
        {/* Ambient Glowing Orbs */}
        <div
          className="pointer-events-none absolute -right-32 -top-24 -z-10 h-96 w-96 rounded-full bg-[#ff8a3d]/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-32 -z-10 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 sm:px-6 text-center">
          {/* Eyebrow Badge */}
          <div className="mb-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-2xs border border-indigo-100">
              <Sparkles className="h-3.5 w-3.5 text-[#ff8a3d]" />
              <span>{hero.eyebrow || "Trusted Marketplace"}</span>
            </span>
          </div>

          {/* Title: Accessible for tests with exact text "About HomeCareX" */}
          <h1
            id="about-hero-title"
            className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-[3.75rem] leading-[1.12]"
          >
            About <span className="text-[#4338ca]">Home<span className="text-[#ff8a3d]">Care</span>X</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-2.5 max-w-3xl text-lg sm:text-2xl md:text-3xl font-extrabold leading-snug text-slate-800">
            {hero.subtitle}
          </p>

          {/* Supporting Description */}
          <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base sm:leading-7">
            {hero.description}
          </p>

          {/* Action CTAs */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 w-full max-w-md mx-auto sm:max-w-none">
            <Link
              to={hero.primaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff8a3d] px-6 py-2.5 text-sm font-bold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <span>{hero.primaryCta.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={hero.secondaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-6 py-2.5 text-sm font-bold text-[#4338ca] shadow-xs transition duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95"
            >
              <span>{hero.secondaryCta.label}</span>
            </Link>
          </div>

          {/* Hero Highlights: Seamless, unboxed highlight strip */}
          <div className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-2.5 text-xs sm:text-sm font-bold text-slate-700">
            {hero.highlights.map((h, i) => {
              const iconMap = [
                <Search key="search" className="h-4 w-4 text-blue-600" />,
                <Calendar key="cal" className="h-4 w-4 text-orange-600" />,
                <RefreshCw key="ref" className="h-4 w-4 text-indigo-600" />,
              ];
              return (
                <div
                  key={h.title}
                  className="inline-flex items-center gap-2 transition hover:text-indigo-600"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100/80">
                    {iconMap[i] || <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </span>
                  <span>{h.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          2. OUR STORY & THE PROBLEM WE SOLVE
          (Mobile interactive dropdown for challenges)
          ========================================================= */}
      <section
        aria-labelledby="about-story-title"
        className="bg-white py-8 sm:py-10 lg:py-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Story Narrative */}
            <div className="lg:col-span-7 space-y-3.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" />
                {story.eyebrow}
              </span>

              <h2
                id="about-story-title"
                className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight"
              >
                {story.heading}
              </h2>

              {/* Callout Quote */}
              <div className="rounded-2xl border-l-4 border-[#ff8a3d] bg-gradient-to-r from-orange-50/70 via-white to-amber-50/30 p-3.5 sm:p-4 shadow-2xs">
                <p className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed">
                  &ldquo;{story.introQuote}&rdquo;
                </p>
              </div>

              {/* Narrative Paragraphs */}
              <div className="space-y-3 text-sm sm:text-base leading-relaxed text-slate-600">
                {story.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <Link
                  to={ROUTES.SERVICES}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4338ca] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95"
                >
                  <span>View Services</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={ROUTES.CONTACT}
                  className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95"
                >
                  <span>Contact Our Team</span>
                </Link>
              </div>
            </div>

            {/* Challenges Addressed: Desktop flow + Mobile interactive dropdown */}
            <div className="lg:col-span-5">
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200/80">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[#ff8a3d]">
                    <Target className="h-4 w-4" />
                  </span>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
                    {story.challengesTitle}
                  </h3>
                </div>

                {/* Desktop View: Unboxed clear flow */}
                <div className="hidden md:block space-y-3.5">
                  {story.challenges.map((c, i) => {
                    const iconColor = [
                      "text-rose-500 bg-rose-50 border-rose-200",
                      "text-amber-500 bg-amber-50 border-amber-200",
                      "text-indigo-500 bg-indigo-50 border-indigo-200",
                    ][i];
                    return (
                      <div key={c.title} className="flex items-start gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-bold text-sm ${iconColor}`}>
                          {i === 0 ? <Search className="h-4 w-4" /> : i === 1 ? <Clock className="h-4 w-4" /> : <Sliders className="h-4 w-4" />}
                        </span>
                        <div className="pt-0.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800 leading-snug block">
                            {c.title}
                          </span>
                          <span className="text-[11px] sm:text-xs text-slate-500 block mt-0.5">
                            {i === 0
                              ? "Solved by standardized, upfront pricing with zero surprises."
                              : i === 1
                              ? "Guaranteed 2-hour arrival windows and instant slot confirmation."
                              : "Real-time step-by-step digital tracking from order to completion."}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile View: Interactive Accordion / Hover-Tap Dropdown */}
                <div className="block md:hidden space-y-2">
                  {story.challenges.map((c, i) => {
                    const isExpanded = expandedChallenge === i;
                    const iconColor = [
                      "text-rose-600 bg-rose-50 border-rose-200",
                      "text-amber-600 bg-amber-50 border-amber-200",
                      "text-indigo-600 bg-indigo-50 border-indigo-200",
                    ][i];
                    return (
                      <div
                        key={c.title}
                        className={`rounded-2xl border transition-all duration-200 ${
                          isExpanded
                            ? "border-indigo-300 bg-indigo-50/30 shadow-xs"
                            : "border-slate-200/80 bg-white"
                        }`}
                        onMouseEnter={() => setExpandedChallenge(i)}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedChallenge(isExpanded ? null : i)}
                          className="w-full flex items-center justify-between gap-3 p-3 text-left focus:outline-none"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${iconColor}`}>
                              {i === 0 ? <Search className="h-3.5 w-3.5" /> : i === 1 ? <Clock className="h-3.5 w-3.5" /> : <Sliders className="h-3.5 w-3.5" />}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {c.title}
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-indigo-600" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>

                        <div
                          className={`grid transition-all duration-300 ease-out overflow-hidden px-3 ${
                            isExpanded ? "grid-rows-[1fr] pb-3 opacity-100" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
                            {i === 0
                              ? "Solved by standardized, upfront pricing with zero surprises or hidden charges."
                              : i === 1
                              ? "Guaranteed 2-hour arrival windows and automated partner dispatch."
                              : "Real-time step-by-step digital tracking from booking to completion."}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Built for real homes &amp; honest partnerships.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. WHAT WE DO (FEATURED SERVICES SHOWCASE)
          (Desktop 4-column grid + Mobile swipeable Carousel Animation)
          ========================================================= */}
      <section
        aria-labelledby="about-what-we-do-title"
        className="bg-slate-50/70 py-8 sm:py-10 lg:py-12 border-y border-slate-200/70"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-what-we-do-title"
            eyebrow={whatWeDo.eyebrow}
            title={whatWeDo.heading}
            text={whatWeDo.description}
          />

          {/* Desktop 4-column Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {whatWeDo.services.map((service, idx) => (
              <Reveal key={service.id} delay={idx * 60}>
                <Link
                  to={service.href}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={`${service.name}: ${service.description}`}
                >
                  <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-slate-100">
                    <img
                      src={service.image}
                      alt={service.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60" />

                    {service.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 shadow-2xs backdrop-blur-xs">
                        {service.category}
                      </span>
                    )}

                    <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-sm shadow-xs backdrop-blur-xs">
                      {idx === 0 ? <Sparkles className="h-3.5 w-3.5 text-blue-600" /> :
                       idx === 1 ? <Wrench className="h-3.5 w-3.5 text-orange-600" /> :
                       idx === 2 ? <Zap className="h-3.5 w-3.5 text-amber-600" /> :
                       <Settings className="h-3.5 w-3.5 text-indigo-600" />}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
                      {service.name}
                    </h3>
                    <p className="mt-1 flex-1 text-xs sm:text-sm leading-relaxed text-slate-500">
                      {service.description}
                    </p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ff8a3d] group-hover:text-[#f97316]">
                      <span>{service.ctaText || "Explore"}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* Mobile Swipeable Carousel Animation */}
          <div
            className="block md:hidden relative overflow-hidden"
            onTouchStart={(e) => {
              serviceTouchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (serviceTouchStartX.current === null) return;
              const deltaX = e.changedTouches[0].clientX - serviceTouchStartX.current;
              serviceTouchStartX.current = null;
              if (Math.abs(deltaX) > 35) {
                if (deltaX < 0) {
                  setActiveServiceSlide((prev) => (prev + 1) % whatWeDo.services.length);
                } else {
                  setActiveServiceSlide((prev) => (prev - 1 + whatWeDo.services.length) % whatWeDo.services.length);
                }
              }
            }}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeServiceSlide * 100}%)` }}
            >
              {whatWeDo.services.map((service, idx) => (
                <div key={service.id} className="w-full shrink-0 px-1">
                  <Link
                    to={service.href}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs"
                    aria-label={`${service.name}: ${service.description}`}
                  >
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                      <img
                        src={service.image}
                        alt={service.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60" />
                      {service.category && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 shadow-2xs">
                          {service.category}
                        </span>
                      )}
                      <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-sm shadow-xs">
                        {idx === 0 ? <Sparkles className="h-3.5 w-3.5 text-blue-600" /> :
                         idx === 1 ? <Wrench className="h-3.5 w-3.5 text-orange-600" /> :
                         idx === 2 ? <Zap className="h-3.5 w-3.5 text-amber-600" /> :
                         <Settings className="h-3.5 w-3.5 text-indigo-600" />}
                      </span>
                    </div>

                    <div className="p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-bold text-slate-900">
                            {service.name}
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {idx + 1} of {whatWeDo.services.length}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                          {service.description}
                        </p>
                      </div>

                      <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-bold text-[#ff8a3d]">
                          {service.ctaText || "Explore"} &rarr;
                        </span>
                        <span className="text-[11px] font-semibold text-indigo-600">
                          Swipe &rarr;
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Carousel Dot Indicators */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {whatWeDo.services.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveServiceSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeServiceSlide === idx
                      ? "w-5 bg-indigo-600"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to service slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Centered Action Button */}
          <div className="mt-7 text-center">
            <Link
              to={ROUTES.SERVICES}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4338ca] px-6 py-2.5 text-sm font-bold text-white shadow-md transition duration-300 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95"
            >
              <span>View All Services</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          4 & 5. OUR MISSION & OUR VISION
          (Desktop 2-column cards + Mobile Segmented Tab/Swipe Carousel)
          ========================================================= */}
      <section
        aria-labelledby="about-mission-title"
        className="bg-gradient-to-b from-white via-indigo-50/15 to-white py-8 sm:py-10 lg:py-14"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-mission-title"
            eyebrow="OUR PURPOSE & FUTURE"
            title="Our Mission & Vision"
            text="How our commitment to simplicity and innovation shapes every service booking."
          />

          {/* Mobile Segmented Switch Pill */}
          <div className="flex md:hidden items-center justify-center p-1 bg-slate-100 rounded-2xl max-w-xs mx-auto mb-4 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveMissionVisionTab("mission")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                activeMissionVisionTab === "mission"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Our Mission
            </button>
            <button
              type="button"
              onClick={() => setActiveMissionVisionTab("vision")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                activeMissionVisionTab === "vision"
                  ? "bg-white text-orange-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Our Vision
            </button>
          </div>

          {/* Desktop 2-column Grid */}
          <div className="hidden md:grid grid-cols-2 gap-5 max-w-6xl mx-auto">
            {/* Card 1: Our Mission */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-indigo-50/35 to-white p-6 sm:p-8 text-slate-800 shadow-lg border border-indigo-200/80 flex flex-col justify-between">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-2xl"
                aria-hidden="true"
              />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-[#4338ca]">
                    <Compass className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold tracking-widest uppercase text-[#4338ca]">
                    OUR MISSION
                  </span>
                </div>

                <blockquote className="text-lg sm:text-xl md:text-2xl font-black leading-snug tracking-tight text-slate-900 mt-2">
                  &ldquo;{mission.statement}&rdquo;
                </blockquote>

                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {mission.supportingText}
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200/70">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#4338ca] mb-2.5">
                  Core Mission Pillars:
                </p>
                <div className="space-y-2">
                  {mission.pillars.map((pillar) => (
                    <div key={pillar.title} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[#4338ca]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{pillar.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Our Vision */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-orange-50/30 to-white p-6 sm:p-8 text-slate-800 shadow-lg border border-orange-200/80 flex flex-col justify-between">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#ff8a3d]/10 blur-2xl"
                aria-hidden="true"
              />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-[#ea580c]">
                    <Target className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold tracking-widest uppercase text-[#ea580c]">
                    OUR VISION
                  </span>
                </div>

                <blockquote className="text-lg sm:text-xl md:text-2xl font-black leading-snug tracking-tight text-slate-900 mt-2">
                  &ldquo;{vision.statement}&rdquo;
                </blockquote>

                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {vision.aspirationalNote}
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200/70">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#ea580c] mb-2.5">
                  Long-Term Commitments:
                </p>
                <div className="space-y-2">
                  {vision.commitments.map((c) => (
                    <div key={c.title} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#ea580c]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Swipeable Card / Segmented Display */}
          <div
            className="block md:hidden overflow-hidden"
            onTouchStart={(e) => {
              missionVisionTouchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (missionVisionTouchStartX.current === null) return;
              const deltaX = e.changedTouches[0].clientX - missionVisionTouchStartX.current;
              missionVisionTouchStartX.current = null;
              if (Math.abs(deltaX) > 35) {
                setActiveMissionVisionTab((prev) => (prev === "mission" ? "vision" : "mission"));
              }
            }}
          >
            {activeMissionVisionTab === "mission" ? (
              <div className="rounded-3xl bg-gradient-to-br from-white via-indigo-50/35 to-white p-5 text-slate-800 shadow-md border border-indigo-200/80 animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-[#4338ca]">
                      <Compass className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold tracking-widest uppercase text-[#4338ca]">
                      OUR MISSION
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded-full">
                    Core Purpose
                  </span>
                </div>

                <blockquote className="text-base font-black leading-snug tracking-tight text-slate-900">
                  &ldquo;{mission.statement}&rdquo;
                </blockquote>

                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {mission.supportingText}
                </p>

                <div className="mt-4 pt-3.5 border-t border-slate-200/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4338ca] mb-2">
                    Core Mission Pillars:
                  </p>
                  <div className="space-y-1.5">
                    {mission.pillars.map((pillar) => (
                      <div key={pillar.title} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[#4338ca]">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        <span>{pillar.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-gradient-to-br from-white via-orange-50/30 to-white p-5 text-slate-800 shadow-md border border-orange-200/80 animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[#ea580c]">
                      <Target className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold tracking-widest uppercase text-[#ea580c]">
                      OUR VISION
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded-full">
                    Future Horizon
                  </span>
                </div>

                <blockquote className="text-base font-black leading-snug tracking-tight text-slate-900">
                  &ldquo;{vision.statement}&rdquo;
                </blockquote>

                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {vision.aspirationalNote}
                </p>

                <div className="mt-4 pt-3.5 border-t border-slate-200/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#ea580c] mb-2">
                    Long-Term Commitments:
                  </p>
                  <div className="space-y-1.5">
                    {vision.commitments.map((c) => (
                      <div key={c.title} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#ea580c]">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        <span>{c.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================
          6. TRUST & SAFETY
          (Desktop 3-column grid + Mobile swipeable Carousel Animation)
          ========================================================= */}
      <section
        aria-labelledby="about-trust-title"
        className="bg-white py-8 sm:py-10 lg:py-12 border-b border-slate-100"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-trust-title"
            eyebrow={trust.eyebrow}
            title={trust.heading}
            text={trust.subtitle}
          />

          {/* Ongoing Improvement Note */}
          <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 text-center shadow-2xs">
            <p className="text-xs sm:text-sm font-semibold text-indigo-900">
              🛡️ &ldquo;{trust.subtleNote}&rdquo;
            </p>
          </div>

          {/* Desktop 3-column Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-6xl mx-auto">
            {trust.practices.map((practice, i) => {
              const icons = [
                <ShieldCheck key="sc" className="h-5 w-5 text-blue-600" />,
                <MessageSquare key="ms" className="h-5 w-5 text-emerald-600" />,
                <Layers key="ly" className="h-5 w-5 text-indigo-600" />,
                <Lock key="lk" className="h-5 w-5 text-amber-600" />,
                <Calendar key="cd" className="h-5 w-5 text-purple-600" />,
                <Award key="aw" className="h-5 w-5 text-orange-600" />,
              ];
              return (
                <div
                  key={practice.title}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-md"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                    {icons[i] || <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {practice.title}
                      </h3>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shrink-0">
                        {practice.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                      Verified safeguards embedded in our booking and fulfillment engine.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Swipeable Carousel Animation */}
          <div
            className="block md:hidden relative overflow-hidden"
            onTouchStart={(e) => {
              trustTouchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (trustTouchStartX.current === null) return;
              const deltaX = e.changedTouches[0].clientX - trustTouchStartX.current;
              trustTouchStartX.current = null;
              if (Math.abs(deltaX) > 35) {
                if (deltaX < 0) {
                  setActiveTrustSlide((prev) => (prev + 1) % trust.practices.length);
                } else {
                  setActiveTrustSlide((prev) => (prev - 1 + trust.practices.length) % trust.practices.length);
                }
              }
            }}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeTrustSlide * 100}%)` }}
            >
              {trust.practices.map((practice, i) => {
                const icons = [
                  <ShieldCheck key="sc" className="h-5 w-5 text-blue-600" />,
                  <MessageSquare key="ms" className="h-5 w-5 text-emerald-600" />,
                  <Layers key="ly" className="h-5 w-5 text-indigo-600" />,
                  <Lock key="lk" className="h-5 w-5 text-amber-600" />,
                  <Calendar key="cd" className="h-5 w-5 text-purple-600" />,
                  <Award key="aw" className="h-5 w-5 text-orange-600" />,
                ];
                return (
                  <div key={practice.title} className="w-full shrink-0 px-1">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                          {icons[i] || <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {practice.tag}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {i + 1}/{trust.practices.length}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {practice.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                        Verified safeguards embedded in our booking and fulfillment engine for peace of mind.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carousel Dot Indicators */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {trust.practices.map((p, idx) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => setActiveTrustSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeTrustSlide === idx
                      ? "w-4 bg-indigo-600"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to trust practice ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* FAQ Card */}
          {trust.faqCta && (
            <div className="mt-6 max-w-4xl mx-auto rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/60 via-white to-orange-50/40 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {trust.faqCta.heading}
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  {trust.faqCta.description}
                </p>
              </div>
              <Link
                to={trust.faqCta.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white border border-indigo-200 px-4 py-2 text-xs sm:text-sm font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-50 active:scale-95"
              >
                <span>{trust.faqCta.buttonLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          7. OUR APPROACH TO QUALITY
          (Desktop connected track + Mobile interactive Stepper with Hover/Tap Dropdown)
          ========================================================= */}
      <section
        aria-labelledby="about-quality-title"
        className="bg-slate-50/70 py-8 sm:py-10 lg:py-12 border-b border-slate-200/70"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-quality-title"
            eyebrow={quality.eyebrow}
            title={quality.heading}
            text={quality.description}
          />

          <div className="mx-auto mb-6 max-w-3xl rounded-2xl border-l-4 border-indigo-600 bg-white p-3.5 sm:p-4 shadow-xs">
            <p className="text-sm sm:text-base font-bold text-slate-800">
              &ldquo;{quality.supportingMessage}&rdquo;
            </p>
          </div>

          {/* Desktop 5-step Horizontal Process Track */}
          <div className="hidden lg:block relative max-w-5xl mx-auto pt-2">
            <div className="absolute top-7 left-12 right-12 h-0.5 bg-gradient-to-r from-indigo-200 via-orange-200 to-indigo-200 -z-0" />

            <div className="grid grid-cols-5 gap-4 relative z-10">
              {quality.steps.map((q) => (
                <div
                  key={q.title}
                  className="flex flex-col items-center text-center gap-2 group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-2 border-indigo-600 font-black text-xs text-indigo-700 shadow-xs transition duration-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-105">
                    {q.step}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ea580c] block">
                      Operational Step {q.step}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug mt-0.5">
                      {q.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile View: Clean Vertical Stepper with Dropdown on Hover/Tap */}
          <div className="block lg:hidden relative max-w-md mx-auto">
            {/* Stepper Connector Line */}
            <div
              className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-500 via-orange-400 to-indigo-600 rounded-full"
              aria-hidden="true"
            />

            <div className="space-y-3">
              {quality.steps.map((q, idx) => {
                const isExpanded = expandedQualityStep === idx;
                return (
                  <div
                    key={q.title}
                    className="relative flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-colors hover:border-indigo-300 cursor-pointer"
                    onMouseEnter={() => setExpandedQualityStep(idx)}
                    onClick={() => setExpandedQualityStep(isExpanded ? null : idx)}
                  >
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs text-white shadow-xs transition-transform duration-200 ${
                        isExpanded ? "bg-indigo-600 scale-105 ring-4 ring-indigo-100" : "bg-indigo-600/90"
                      }`}
                    >
                      {q.step}
                    </span>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
                          Operational Step {q.step}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-indigo-600" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                        {q.title}
                      </h3>

                      {/* Dropdown Description */}
                      <div
                        className={`grid transition-all duration-300 ease-out overflow-hidden ${
                          isExpanded ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                            Strict operating benchmarks applied across vetting, service fulfillment, and customer validation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          8. THE PEOPLE BEHIND HOMECAREX (TEAM DISCIPLINES)
          (Desktop 4-column grid + Mobile interactive Accordion Dropdown)
          ========================================================= */}
      <section
        aria-labelledby="about-team-title"
        className="bg-white py-8 sm:py-10 lg:py-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-team-title"
            eyebrow={team.eyebrow}
            title={team.heading}
            text={team.subtitle}
          />

          <div className="mx-auto mb-6 max-w-3xl text-center">
            <p className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700">
              &ldquo;{team.intro}&rdquo;
            </p>
          </div>

          {/* Desktop 4-column Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {team.disciplines.map((item, i) => {
              const icons = [
                <Laptop key="lp" className="h-5 w-5 text-blue-600" />,
                <Settings key="st" className="h-5 w-5 text-orange-600" />,
                <Headphones key="hp" className="h-5 w-5 text-emerald-600" />,
                <ShieldCheck key="sc" className="h-5 w-5 text-purple-600" />,
              ];
              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                        {icons[i] || <Users className="h-5 w-5 text-indigo-600" />}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Discipline
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-indigo-600">
                      {item.scope}
                    </p>

                    <div className="mt-3.5 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Focus Areas:
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {item.focusAreas.map((area) => (
                          <li key={area} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" />
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Mobile View: Interactive Accordion Dropdowns */}
          <div className="block md:hidden space-y-2.5 max-w-md mx-auto">
            {team.disciplines.map((item, i) => {
              const isExpanded = expandedTeamDiscipline === item.id;
              const icons = [
                <Laptop key="lp" className="h-4 w-4 text-blue-600" />,
                <Settings key="st" className="h-4 w-4 text-orange-600" />,
                <Headphones key="hp" className="h-4 w-4 text-emerald-600" />,
                <ShieldCheck key="sc" className="h-4 w-4 text-purple-600" />,
              ];
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all duration-200 ${
                    isExpanded ? "border-indigo-300 bg-indigo-50/25 shadow-xs" : "border-slate-200/80 bg-white"
                  }`}
                  onMouseEnter={() => setExpandedTeamDiscipline(item.id)}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTeamDiscipline(isExpanded ? null : item.id)}
                    className="w-full flex items-center justify-between p-3.5 text-left focus:outline-none"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                        {icons[i] || <Users className="h-4 w-4 text-indigo-600" />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.title}
                        </h3>
                        <p className="text-[10px] font-semibold text-indigo-600">
                          {item.scope}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-indigo-600" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-out overflow-hidden px-3.5 ${
                      isExpanded ? "grid-rows-[1fr] pb-3 opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden border-t border-slate-100 pt-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Focus Areas:
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {item.focusAreas.map((area) => (
                          <li key={area} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" />
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          9. OUR CORE VALUES
          (Desktop 5-column grid + Mobile swipeable Carousel Animation)
          ========================================================= */}
      <section
        aria-labelledby="about-values-title"
        className="bg-slate-50/70 py-8 sm:py-10 lg:py-12 border-t border-slate-200/70"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-values-title"
            eyebrow={values.eyebrow}
            title={values.heading}
            text={values.subtitle}
          />

          {/* Desktop 5-column Grid */}
          <div className="hidden md:grid grid-cols-3 xl:grid-cols-5 gap-3.5 max-w-7xl mx-auto">
            {values.items.map((val, idx) => {
              const valIcons = [
                <Target key="tg" className="h-5 w-5 text-blue-600" />,
                <Search key="sr" className="h-5 w-5 text-indigo-600" />,
                <Users key="us" className="h-5 w-5 text-amber-600" />,
                <Scale key="sc" className="h-5 w-5 text-emerald-600" />,
                <TrendingUp key="tu" className="h-5 w-5 text-orange-600" />,
              ];
              return (
                <div
                  key={val.title}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                        {valIcons[idx] || <Award className="h-5 w-5 text-indigo-600" />}
                      </span>
                      <span className="rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 text-[10px] font-bold">
                        Value {val.number}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {val.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                      {val.tagline}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Swipeable Carousel Animation */}
          <div
            className="block md:hidden relative overflow-hidden"
            onTouchStart={(e) => {
              valueTouchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (valueTouchStartX.current === null) return;
              const deltaX = e.changedTouches[0].clientX - valueTouchStartX.current;
              valueTouchStartX.current = null;
              if (Math.abs(deltaX) > 35) {
                if (deltaX < 0) {
                  setActiveValueSlide((prev) => (prev + 1) % values.items.length);
                } else {
                  setActiveValueSlide((prev) => (prev - 1 + values.items.length) % values.items.length);
                }
              }
            }}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeValueSlide * 100}%)` }}
            >
              {values.items.map((val, idx) => {
                const valIcons = [
                  <Target key="tg" className="h-5 w-5 text-blue-600" />,
                  <Search key="sr" className="h-5 w-5 text-indigo-600" />,
                  <Users key="us" className="h-5 w-5 text-amber-600" />,
                  <Scale key="sc" className="h-5 w-5 text-emerald-600" />,
                  <TrendingUp key="tu" className="h-5 w-5 text-orange-600" />,
                ];
                return (
                  <div key={val.title} className="w-full shrink-0 px-1">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                          {valIcons[idx] || <Award className="h-5 w-5 text-indigo-600" />}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 text-[10px] font-bold">
                            Value {val.number}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {idx + 1}/{values.items.length}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">
                        {val.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                        {val.tagline}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carousel Dot Indicators */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {values.items.map((v, idx) => (
                <button
                  key={v.title}
                  type="button"
                  onClick={() => setActiveValueSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeValueSlide === idx
                      ? "w-4 bg-orange-500"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to value ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          10. HOW HOMECAREX CONNECTS PEOPLE (3-STEP TIMELINE)
          (Desktop 3-column cards + Mobile Stepper Accordion Dropdown)
          ========================================================= */}
      <section
        aria-labelledby="about-connects-title"
        className="bg-white py-8 sm:py-10 lg:py-12 border-t border-slate-200/70"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            id="about-connects-title"
            eyebrow={howItWorks.eyebrow}
            title={howItWorks.heading}
            text={howItWorks.subtitle}
          />

          {/* Desktop 3-column Cards */}
          <div className="hidden md:grid grid-cols-3 gap-5 max-w-6xl mx-auto">
            {howItWorks.steps.map((st) => (
              <div
                key={st.title}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/30 to-white p-5 sm:p-6 shadow-xs transition duration-300 hover:border-indigo-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-black text-sm shadow-2xs border border-indigo-100">
                      {st.number}
                    </span>
                    <span className="rounded-full bg-[#ff8a3d] px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                      Step {st.number}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {st.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-indigo-600">
                    {st.summary}
                  </p>

                  <div className="mt-4 border-t border-slate-100 pt-3.5">
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {st.details.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile View: Vertical Stepper Accordion Dropdown */}
          <div className="block md:hidden relative max-w-md mx-auto">
            <div
              className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-[#ff8a3d] rounded-full"
              aria-hidden="true"
            />

            <div className="space-y-3">
              {howItWorks.steps.map((st, idx) => {
                const isExpanded = expandedConnectStep === idx;
                return (
                  <div
                    key={st.title}
                    className="relative flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-colors hover:border-indigo-300 cursor-pointer"
                    onMouseEnter={() => setExpandedConnectStep(idx)}
                    onClick={() => setExpandedConnectStep(isExpanded ? null : idx)}
                  >
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs text-white shadow-xs transition-transform duration-200 ${
                        isExpanded ? "bg-[#ff8a3d] scale-105 ring-4 ring-orange-100" : "bg-indigo-600"
                      }`}
                    >
                      {st.number}
                    </span>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
                          Step {st.number}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-orange-600" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                        {st.title}
                      </h3>
                      <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                        {st.summary}
                      </p>

                      {/* Dropdown Checklist */}
                      <div
                        className={`grid transition-all duration-300 ease-out overflow-hidden ${
                          isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden border-t border-slate-100 pt-2">
                          <ul className="space-y-1.5 text-xs text-slate-600">
                            {st.details.map((item) => (
                              <li key={item} className="flex items-start gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          11. FINAL RADIANT CALL TO ACTION
          ========================================================= */}
      <section
        aria-labelledby="about-cta-title"
        className="px-4 sm:px-6 lg:px-8 py-8 sm:py-10 bg-gradient-to-b from-white to-slate-50 border-t border-slate-200/70"
      >
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/90 via-white to-orange-50/70 p-6 sm:p-10 lg:p-12 text-center text-slate-800 shadow-xl border border-indigo-100/90">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#ff8a3d]/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200/80 shadow-2xs mb-2.5">
              <Sparkles className="h-3.5 w-3.5 text-[#ff8a3d]" />
              <span>EXPERIENCE THE DIFFERENCE</span>
            </span>

            <h2
              id="about-cta-title"
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight"
            >
              {cta.heading}
            </h2>

            <p className="mx-auto mt-2.5 max-w-xl text-sm sm:text-base leading-relaxed text-slate-600">
              {cta.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 max-w-md mx-auto sm:max-w-none">
              <Link
                to={cta.primaryCta.href}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff8a3d] px-7 py-3 text-sm font-bold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              >
                <span>{cta.primaryCta.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={cta.secondaryCta.href}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-7 py-3 text-sm font-bold text-[#4338ca] shadow-xs transition duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95"
              >
                <span>{cta.secondaryCta.label}</span>
              </Link>
            </div>

            <div className="mt-7 pt-5 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-4 sm:gap-7 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Standardized Pricing
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Verified Professionals
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Secure Online Experience
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
