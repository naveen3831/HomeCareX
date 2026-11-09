import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users,
  Search,
  Calendar,
  RefreshCw,
  Award,
  Check,
  TrendingUp,
  Compass,
  Target,
  ShieldCheck,
  Scale,
  ChevronDown,
} from "lucide-react";
import { aboutData } from "../../../content/about";
import { ROUTES } from "../../../constants/routes";

/* =========================================================
   EXACT FONT FAMILIES AS HOME PAGE
   Headings: 'Poppins', 'Manrope', system-ui, sans-serif (-0.02em)
   Body: 'Manrope', system-ui, sans-serif
========================================================= */
const aboutTypographyStyles = `
.hcx-about {
  font-family: 'Manrope', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
}

.hcx-about h1, .hcx-about h2, .hcx-about h3, .hcx-about h4, .hcx-about .display {
  font-family: 'Poppins', 'Manrope', system-ui, sans-serif;
  letter-spacing: -0.02em;
  transition: color 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Subtle Interactive Heading Hover Effects */
.hcx-about h2.hover-heading:hover,
.hcx-about h3.hover-heading:hover,
.hcx-about h4.hover-heading:hover,
.hcx-about .hover-heading:hover {
  color: #4338ca;
}

.hcx-about .group:hover .group-hover-heading {
  color: #4338ca;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

/* =========================================================
   ABOUT PAGE COMPONENT
========================================================= */
const AboutPage: React.FC = () => {
  const {
    hero,
    story,
    mission,
    vision,
    values,
    cta,
  } = aboutData;

  // Active Zoho Section Tab (Defaults to Mission & Vision)
  const [activeTab, setActiveTab] = useState<string>("mission-vision");

  // Mobile challenge accordion in Story section
  const [expandedChallenge, setExpandedChallenge] = useState<number | null>(0);

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

  // Navigation Tabs matching Zoho About Us vertical layout
  const ZOHO_TABS = [
    {
      id: "mission-vision",
      shortLabel: "Mission & Vision",
      title: "Our Mission & Vision",
    },
    {
      id: "values",
      shortLabel: "Core Values",
      title: "Our Core Values & Principles",
    },
  ];

  return (
    <div className="hcx-about min-h-screen bg-white">
      {/* Dynamic Font Styling matching Home Page */}
      <style>{aboutTypographyStyles}</style>

      {/* Screen-reader heading bookmark */}
      <div className="sr-only">
        <h2>HomeCareX Marketplace Architecture</h2>
      </div>

      {/* =========================================================
          1. HERO SECTION (EXACT MARGIN: max-w-7xl px-5 sm:px-8 lg:px-10)
          ========================================================= */}
      <section
        aria-labelledby="about-hero-title"
        className="relative overflow-hidden bg-gradient-to-b from-[#eff4ff] via-white to-slate-50 pt-10 sm:pt-14 pb-8 sm:pb-10 border-b border-slate-100"
      >
        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 text-center flex flex-col items-center">
          {/* Eyebrow badge */}
          <div className="mb-3.5 inline-flex items-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700 shadow-2xs border border-indigo-100">
              <Sparkles className="h-4 w-4 text-[#ff8a3d]" />
              <span>{hero.eyebrow || "Trusted Marketplace"}</span>
            </span>
          </div>

          <h1
            id="about-hero-title"
            className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl leading-[1.15]"
          >
            About <span className="text-[#4338ca]">Home<span className="text-[#ff8a3d]">Care</span>X</span>
          </h1>

          <p className="mt-3 max-w-2xl text-base sm:text-xl md:text-2xl font-extrabold leading-snug text-slate-800">
            {hero.subtitle}
          </p>

          <p className="mx-auto mt-2 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
            {hero.description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3.5 w-full max-w-md sm:max-w-none mx-auto">
            <Link
              to={hero.primaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl bg-[#ff8a3d] px-3 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-base font-bold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center"
            >
              <span className="truncate">{hero.primaryCta.label}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            </Link>
            <Link
              to={hero.secondaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-3 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-base font-bold text-[#4338ca] shadow-xs transition duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95 text-center"
            >
              <span className="truncate">{hero.secondaryCta.label}</span>
            </Link>
          </div>

          {/* Highlights: 3 points in 1 single row on mobile view */}
          <div className="mt-6 sm:mt-8 grid grid-cols-3 sm:flex sm:flex-wrap items-start sm:items-center justify-center gap-1.5 sm:gap-x-10 text-[10px] sm:text-base font-bold text-slate-700 w-full max-w-sm sm:max-w-none mx-auto">
            {hero.highlights.map((h, i) => {
              const iconMap = [
                <Search key="search" className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />,
                <Calendar key="cal" className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />,
                <RefreshCw key="ref" className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />,
              ];
              return (
                <div
                  key={h.title}
                  className="flex flex-col sm:flex-row items-center justify-start text-center sm:text-left gap-1 sm:gap-2.5 transition hover:text-indigo-600 px-0.5"
                >
                  <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
                    {iconMap[i] || <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />}
                  </span>
                  <span className="leading-tight sm:leading-normal">{h.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          2. OUR STORY & THE PROBLEM WE SOLVE
          (EXACT MARGIN: max-w-7xl px-5 sm:px-8 lg:px-10)
          ========================================================= */}
      <section
        aria-labelledby="about-story-title"
        className="bg-white py-8 sm:py-12 border-b border-slate-100"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7 space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                {story.eyebrow}
              </span>

              <h2
                id="about-story-title"
                className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default"
              >
                {story.heading}
              </h2>

              <p className="text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
                {story.paragraphs?.[0]}
              </p>

              <div className="grid sm:grid-cols-2 gap-4 pt-1">
                <div className="group rounded-2xl border border-red-100 bg-red-50/40 p-4 transition duration-300 hover:border-red-200 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-red-700 font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="group-hover:text-red-800 transition-colors">The Challenge</span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {story.paragraphs?.[1]}
                  </p>
                </div>

                <div className="group rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 transition duration-300 hover:border-emerald-200 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="group-hover:text-emerald-800 transition-colors">The HomeCareX Standard</span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {story.paragraphs?.[2]}
                  </p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium pt-1 italic border-l-3 border-[#ff8a3d] pl-4">
                "{story.introQuote}"
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-100 aspect-[16/10] mb-4 group bg-slate-100">
                <img
                  src="/images/about/about-plumber.jpg"
                  alt="HomeCareX certified craftsman at work"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-4 right-4 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#ff8a3d]" />
                  <span>Hands-On Craftsmanship &amp; Certified Standards</span>
                </div>
              </div>

              {/* Challenge points accordion */}
              <div className="space-y-2">
                {story.challenges.map((c, i) => {
                  const isOpen = expandedChallenge === i;
                  return (
                    <div
                      key={c.title}
                      className="rounded-xl border border-slate-200/80 bg-white overflow-hidden transition-all duration-200 hover:border-indigo-200"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedChallenge(isOpen ? null : i)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold text-slate-800 hover:text-indigo-600 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          <span className="hover:text-indigo-600 transition-colors">{c.title}</span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? "rotate-180 text-indigo-600" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-3.5 pb-2.5 pt-1 text-xs text-slate-600 border-t border-slate-100 bg-slate-50/50">
                          <p className="font-medium text-indigo-900">
                            HomeCareX Solution:{" "}
                            <span className="text-slate-600 font-normal">
                              {c.description}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. MAIN ZOHO-STYLE LEFT VERTICAL TABS LAYOUT
          (PREVIOUS EDITORIAL STYLE: NO CARD CONTAINER BOX)
          (EXACT MARGIN: max-w-7xl px-5 sm:px-8 lg:px-10)
          ========================================================= */}
      <section
        aria-label="HomeCareX Core Marketplace Pillars"
        className="hidden lg:block bg-white py-10 sm:py-14 border-b border-slate-100"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          {/* Mobile Horizontal Scrollable Tab Bar (< lg screens) */}
          <div className="lg:hidden w-full overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 mb-6 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 min-w-max">
              {ZOHO_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-[#4338ca] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {tab.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Vertical Zoho Tab Navigation (Desktop Only: lg:block, completely undisturbed) */}
            <aside
              aria-label="About page section menu"
              className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24"
            >
              <nav className="flex flex-col border-l-2 border-slate-100">
                {ZOHO_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group text-left py-3.5 pl-5 pr-2 text-sm sm:text-base font-bold transition-all duration-200 border-l-2 -ml-[2px] cursor-pointer ${
                        isActive
                          ? "border-l-[#ff8a3d] text-[#4338ca] font-extrabold"
                          : "border-l-transparent text-slate-600 hover:text-slate-900 hover:border-l-slate-300"
                      }`}
                    >
                      <span className={`transition-colors ${isActive ? "text-[#4338ca]" : "group-hover:text-slate-900"}`}>
                        {tab.title}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Right Tab Content Container */}
            <main
              id="zoho-about-section-content"
              tabIndex={-1}
              className="lg:col-span-9 bg-white min-h-[500px]"
            >
              {/* ================= TAB 1: OUR MISSION & VISION ================= */}
              {activeTab === "mission-vision" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {mission.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        Our Mission &amp; Vision
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {mission.statement}
                      </p>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        {vision.statement}
                      </p>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-electrician.jpg"
                          alt="HomeCareX certified electrician performing diagnostics"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Standardized quality benchmarks for every home visit.
                      </p>
                    </div>
                  </div>

                  {/* 2-Column Pillars: Mission & Vision */}
                  <div className="grid sm:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                    <div className="group rounded-2xl border border-indigo-200/80 bg-indigo-50/30 p-5 hover:border-indigo-400 transition-colors">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-[#4338ca]">
                          <Compass className="h-4 w-4" />
                        </span>
                        <h3 className="group-hover-heading text-xs sm:text-sm font-bold tracking-widest uppercase text-[#4338ca]">
                          OUR MISSION PILLARS
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {mission.pillars.map((pillar) => (
                          <div key={pillar.title} className="flex items-center gap-2.5 text-sm sm:text-base font-semibold text-slate-800">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[#4338ca]">
                              <Check className="h-3 w-3" />
                            </span>
                            <span>{pillar.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="group rounded-2xl border border-orange-200/80 bg-orange-50/30 p-5 hover:border-orange-400 transition-colors">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[#ea580c]">
                          <Target className="h-4 w-4" />
                        </span>
                        <h3 className="group-hover-heading text-xs sm:text-sm font-bold tracking-widest uppercase text-[#ea580c]">
                          LONG-TERM COMMITMENTS
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {vision.commitments.map((c) => (
                          <div key={c.title} className="flex items-center gap-2.5 text-sm sm:text-base font-semibold text-slate-800">
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
              )}

              {/* ================= TAB 2: OUR CORE VALUES & PRINCIPLES ================= */}
              {activeTab === "values" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {values.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        {values.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {values.subtitle}
                      </p>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        Our values serve as our daily operating code, guiding product design, partner onboarding, and customer interactions.
                      </p>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-electrician.jpg"
                          alt="HomeCareX professional embodying craft integrity"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Integrity and transparent service in every home.
                      </p>
                    </div>
                  </div>

                  {/* 3rd Image: Latest Modern Editorial Strip Matrix (NO CARD BOXES, NO GUIDING STANDARD COLUMN) */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                        <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                          Core Operating Principles:
                        </h3>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-400">
                        5 Guiding Pillars
                      </span>
                    </div>

                    {/* Editorial Interactive Rows (Zero Card Boxes, No Guiding Standard Column) */}
                    <div className="divide-y divide-slate-100 border-y border-slate-100">
                      {values.items.map((val) => {
                        const valIcons: Record<string, React.ReactNode> = {
                          "Customer First": <Target className="h-5 w-5 text-indigo-600" />,
                          "Transparency": <Search className="h-5 w-5 text-indigo-600" />,
                          "Respect": <Users className="h-5 w-5 text-amber-600" />,
                          "Responsibility": <Scale className="h-5 w-5 text-emerald-600" />,
                          "Continuous Improvement": <TrendingUp className="h-5 w-5 text-orange-600" />,
                        };
                        return (
                          <div
                            key={val.title}
                            className="group relative py-4 sm:py-5 px-3 sm:px-5 transition-all duration-300 hover:bg-gradient-to-r hover:from-indigo-50/70 hover:via-white hover:to-orange-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-8 cursor-pointer rounded-xl"
                          >
                            {/* Left: Numeral + Icon + Title (No Truncation) */}
                            <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 sm:min-w-[280px]">
                              <span className="text-lg sm:text-xl font-black text-slate-300 group-hover:text-[#ff8a3d] transition-colors tabular-nums shrink-0">
                                {val.number}
                              </span>
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs group-hover:bg-white group-hover:scale-110 transition-all">
                                {valIcons[val.title] || <Award className="h-5 w-5 text-indigo-600" />}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                  Pillar {val.number}
                                </span>
                                <h4 className="group-hover-heading text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                                  {val.title}
                                </h4>
                              </div>
                            </div>

                            {/* Right: Tagline statement (Fills full width, guiding standard column removed) */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-normal group-hover:text-slate-900 transition-colors">
                                {val.tagline}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </main>
          </div>
        </div>
      </section>

      {/* =========================================================
          4. FINAL CALL TO ACTION
          (EXACT MARGIN: max-w-7xl px-5 sm:px-8 lg:px-10)
          ========================================================= */}
      <section
        aria-labelledby="about-cta-title"
        className="py-10 sm:py-14 bg-gradient-to-b from-white to-slate-50 border-t-0 lg:border-t border-slate-200/70"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="relative mx-auto overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/90 via-white to-orange-50/70 p-6 sm:p-10 lg:p-12 text-center text-slate-800 shadow-md border border-indigo-100/90">
            <div
              className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#ff8a3d]/15 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[#4338ca]/15 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10 max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700 border border-indigo-200/80 shadow-2xs mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[#ff8a3d]" />
                <span>EXPERIENCE THE DIFFERENCE</span>
              </span>

              <h2
                id="about-cta-title"
                className="hover-heading text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight cursor-default"
              >
                {cta.heading}
              </h2>

              <p className="mt-3 text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                {cta.description}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3.5 w-full max-w-md sm:max-w-none mx-auto">
                <Link
                  to={cta.primaryCta?.href || ROUTES.SERVICES}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-[#ff8a3d] px-3 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-base font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center"
                >
                  <span className="truncate">{cta.primaryCta?.label || "Explore Services"}</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </Link>
                <Link
                  to={cta.secondaryCta?.href || ROUTES.PARTNER_REGISTER}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-3 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-base font-bold text-[#4338ca] shadow-xs transition hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center"
                >
                  <span className="truncate">{cta.secondaryCta?.label || "Become a Partner"}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
