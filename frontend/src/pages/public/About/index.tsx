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
  Layers,
  MessageSquare,
  Lock,
  TrendingUp,
  Compass,
  Target,
  Laptop,
  Settings,
  Headphones,
  ShieldCheck,
  Scale,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
} from "lucide-react";
import { aboutData } from "../../../content/about";
import { ROUTES } from "../../../constants/routes";
import { useCategories } from "../../../hooks/useCategories";
import { serviceImageFor } from "../../../lib/serviceImage";

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

  // Active Zoho Section Tab
  const [activeTab, setActiveTab] = useState<string>("what-we-do");

  // Mobile challenge accordion in Story section
  const [expandedChallenge, setExpandedChallenge] = useState<number | null>(0);

  // Categories from Backend with Fallback
  const categoriesQuery = useCategories();
  const backendCategories =
    categoriesQuery.data && categoriesQuery.data.length > 0
      ? categoriesQuery.data
      : null;

  const defaultCategoryImages = [
    "/images/about/about-cleaning-team.jpg",
    "/images/about/about-plumber.jpg",
    "/images/about/about-electrician.jpg",
    "/images/about/about-service-crew.jpg",
  ];

  const categoryItems = backendCategories
    ? backendCategories.map((cat, idx) => ({
        id: cat.id || cat.slug,
        name: cat.name,
        category: cat.serviceCount ? `${cat.serviceCount} Services` : "Verified Care",
        description:
          cat.description ||
          "Certified home care specialists with transparent upfront pricing.",
        image:
          cat.imageUrl ||
          serviceImageFor(cat.slug || cat.name) ||
          defaultCategoryImages[idx % defaultCategoryImages.length],
        href: `/services?category=${encodeURIComponent(cat.slug || cat.name)}`,
      }))
    : whatWeDo.services.map((svc) => ({
        id: svc.id,
        name: svc.name,
        category: svc.category,
        description: svc.description,
        image: svc.image,
        href: `/services?category=${encodeURIComponent(svc.name.toLowerCase().replace(/\s+/g, "-"))}`,
      }));

  const totalServiceSlides = Math.max(1, Math.ceil(categoryItems.length / 2));

  // 1st Image: Featured Marketplace Offerings Carousel Animation
  const [servicesSlide, setServicesSlide] = useState<number>(0);
  const [isServicesPaused, setIsServicesPaused] = useState<boolean>(false);

  // 4th Image: Cross-Functional Disciplines Carousel Animation (0: [0,1], 1: [2,3])
  const [teamCarouselSlide, setTeamCarouselSlide] = useState<number>(0);
  const [isTeamPaused, setIsTeamPaused] = useState<boolean>(false);

  // 5th Image: Quality Lifecycle Pathway Stepper Hover State
  const [hoveredQualityStep, setHoveredQualityStep] = useState<number | null>(null);

  // 2nd Image: 4-Step Customer Journey Stepper Hover State
  const [hoveredJourneyStep, setHoveredJourneyStep] = useState<number | null>(null);

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

  // Auto-play Carousel Animation for 1st Image (Featured Marketplace Offerings)
  useEffect(() => {
    if (activeTab !== "what-we-do" || isServicesPaused || totalServiceSlides <= 1) return;
    const interval = setInterval(() => {
      setServicesSlide((prev) => (prev + 1) % totalServiceSlides);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeTab, isServicesPaused, totalServiceSlides]);

  // Auto-play Carousel Animation for 4th Image (Cross-Functional Disciplines)
  useEffect(() => {
    if (activeTab !== "team" || isTeamPaused) return;
    const interval = setInterval(() => {
      setTeamCarouselSlide((prev) => (prev === 0 ? 1 : 0));
    }, 4500);
    return () => clearInterval(interval);
  }, [activeTab, isTeamPaused]);

  // 7 Navigation Tabs matching Zoho About Us vertical layout
  const ZOHO_TABS = [
    {
      id: "what-we-do",
      shortLabel: "What We Do",
      title: "Home Services, Made Simpler",
    },
    {
      id: "mission-vision",
      shortLabel: "Mission & Vision",
      title: "Our Mission & Vision",
    },
    {
      id: "safeguards",
      shortLabel: "Trust & Safety",
      title: "Trust & Safety Safeguards",
    },
    {
      id: "quality",
      shortLabel: "Quality Approach",
      title: "Our Approach to Quality",
    },
    {
      id: "team",
      shortLabel: "Our Team",
      title: "The People Behind HomeCareX",
    },
    {
      id: "values",
      shortLabel: "Core Values",
      title: "Our Core Values & Principles",
    },
    {
      id: "marketplace",
      shortLabel: "Customer Journey",
      title: "How HomeCareX Connects",
    },
  ];

  // Quality step concise phase descriptions
  const qualityStepDescriptions = [
    "Upfront transparent rate cards and task inclusions.",
    "Standardized checklists and verified tooling.",
    "Automated slot booking with live progress updates.",
    "Skill vetting, fair earnings, and technician gear.",
    "Customer ratings, workflow audits, and resolution.",
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

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5 w-full max-w-md mx-auto sm:max-w-none">
            <Link
              to={hero.primaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#ff8a3d] px-7 py-3 text-sm sm:text-base font-bold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <span>{hero.primaryCta.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={hero.secondaryCta.href}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-7 py-3 text-sm sm:text-base font-bold text-[#4338ca] shadow-xs transition duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95"
            >
              <span>{hero.secondaryCta.label}</span>
            </Link>
          </div>

          {/* Highlights */}
          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-10 gap-y-3 text-sm sm:text-base font-bold text-slate-700">
            {hero.highlights.map((h, i) => {
              const iconMap = [
                <Search key="search" className="h-4 w-4 text-blue-600" />,
                <Calendar key="cal" className="h-4 w-4 text-orange-600" />,
                <RefreshCw key="ref" className="h-4 w-4 text-indigo-600" />,
              ];
              return (
                <div
                  key={h.title}
                  className="inline-flex items-center gap-2.5 transition hover:text-indigo-600"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
                    {iconMap[i] || <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
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
        className="bg-white py-10 sm:py-14 border-b border-slate-100"
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
              {/* ================= TAB 1: WHAT WE DO (BACKEND CATEGORIES CAROUSEL) ================= */}
              {activeTab === "what-we-do" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {whatWeDo.eyebrow}
                      </span>
                      <h2
                        id="zoho-about-section-heading"
                        className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default"
                      >
                        {whatWeDo.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {whatWeDo.description}
                      </p>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        Standardized pricing, transparent task scopes, and verified technicians replace uncertainty with reliable doorstep care.
                      </p>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-cleaning-team.jpg"
                          alt="HomeCareX verified cleaning team in a modern home"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Verified home care specialists delivering trusted doorstep care.
                      </p>
                    </div>
                  </div>

                  {/* Categories from Backend Carousel Animation with 2 cols per view */}
                  <div
                    className="pt-6 border-t border-slate-100"
                    onMouseEnter={() => setIsServicesPaused(true)}
                    onMouseLeave={() => setIsServicesPaused(false)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                        <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                          Featured Marketplace Offerings
                        </h3>
                      </div>

                      {/* Carousel Animation Controls */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 mr-2">
                          {servicesSlide + 1} / {totalServiceSlides}
                        </span>
                        <button
                          type="button"
                          aria-label="Previous categories"
                          onClick={() => setServicesSlide((prev) => (prev - 1 + totalServiceSlides) % totalServiceSlides)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition shadow-2xs cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next categories"
                          onClick={() => setServicesSlide((prev) => (prev + 1) % totalServiceSlides)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition shadow-2xs cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Animated 2-Column Carousel View from Backend Categories */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryItems
                        .slice(servicesSlide * 2, servicesSlide * 2 + 2)
                        .map((svc) => (
                          <div
                            key={svc.id}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                          >
                            <div className="flex items-start gap-4">
                              <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                <img
                                  src={svc.image}
                                  alt={svc.name}
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="group-hover-heading text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {svc.name}
                                  </h4>
                                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                                    {svc.category}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                  {svc.description}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <Link
                                to={svc.href}
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#ff8a3d] hover:text-[#ea580c] transition cursor-pointer"
                              >
                                <span>Explore Services</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                              <span className="text-[11px] font-semibold text-slate-400">
                                Verified Specialists
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Carousel Indicators */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {Array.from({ length: totalServiceSlides }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Slide ${idx + 1}`}
                          onClick={() => setServicesSlide(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            servicesSlide === idx ? "w-7 bg-[#4338ca]" : "w-2 bg-slate-200 hover:bg-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 2: OUR MISSION & VISION ================= */}
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

              {/* ================= TAB 3: PLATFORM SAFEGUARDS (NO CARD STYLE) ================= */}
              {activeTab === "safeguards" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {trust.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        {trust.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {trust.subtitle}
                      </p>
                      <div className="rounded-2xl bg-indigo-50/60 border-l-4 border-indigo-600 p-4 text-sm sm:text-base text-indigo-950 leading-relaxed font-medium">
                        "{trust.subtleNote}"
                      </div>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-service-crew.jpg"
                          alt="HomeCareX deep-cleaning specialists in action"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Certified safeguards at every stage of booking.
                      </p>
                    </div>
                  </div>

                  {/* Active Safeguards: Pure Editorial Style (NO CARD BORDERS/BOXES) */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                      <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                        Active Platform Safeguards:
                      </h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
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
                          <div key={practice.title} className="group flex items-start gap-4 pb-4 border-b border-slate-100 last:border-b-0 md:last:border-b md:[&:nth-last-child(2)]:border-b">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50/80 text-indigo-600 shadow-2xs mt-0.5 group-hover:bg-indigo-100 transition-colors">
                              {icons[i] || <CheckCircle2 className="h-5 w-5" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5">
                                <h4 className="group-hover-heading text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {practice.title}
                                </h4>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                  {practice.tag}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                                {practice.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* FAQ CTA Banner */}
                  {trust.faqCta && (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                      <div>
                        <h4 className="hover-heading text-sm sm:text-base font-bold text-slate-900">
                          {trust.faqCta.heading}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                          {trust.faqCta.description}
                        </p>
                      </div>
                      <Link
                        to={ROUTES.FAQ}
                        className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 transition shadow-2xs"
                      >
                        <span>{trust.faqCta.buttonLabel}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* ================= TAB 4: OUR APPROACH TO QUALITY (STEPPER ONLY, NO CARDS, HOVER SUB-CONTEXT) ================= */}
              {activeTab === "quality" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {quality.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        {quality.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {quality.supportingMessage}
                      </p>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        {quality.description}
                      </p>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-plumber.jpg"
                          alt="HomeCareX certified craftsman delivering verified repair quality"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        High standards maintained through systematic workflow auditing.
                      </p>
                    </div>
                  </div>

                  {/* Connected Stepper with Headings Down Each Step (NO CARD BOXES, STRICT 5-STEP BOUNDARY) */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-8">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                      <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                        The Quality Lifecycle Stepper:
                      </h3>
                    </div>

                    {/* Stepper with connecting line strictly between node 1 (10%) and node 5 (90%) */}
                    <div className="relative py-2">
                      {/* Base Track */}
                      <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-1 bg-slate-200 -z-0 rounded-full" />
                      {/* Active Progress Track: strictly capped at node 5 */}
                      <div
                        className="hidden md:block absolute top-6 left-[10%] h-1 bg-gradient-to-r from-indigo-600 via-[#ff8a3d] to-emerald-500 -z-0 rounded-full transition-all duration-500"
                        style={{
                          width:
                            hoveredQualityStep !== null
                              ? `${(hoveredQualityStep / 4) * 80}%`
                              : "80%",
                          maxWidth: "80%",
                        }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-3">
                        {quality.steps.map((st, idx) => {
                          const isHovered = hoveredQualityStep === idx;
                          return (
                            <div
                              key={st.step}
                              className="group flex flex-col items-center text-center cursor-pointer relative"
                              onMouseEnter={() => setHoveredQualityStep(idx)}
                              onMouseLeave={() => setHoveredQualityStep(null)}
                              onClick={() => setHoveredQualityStep(hoveredQualityStep === idx ? null : idx)}
                            >
                              {/* Step Node */}
                              <div className="relative z-10 mb-2">
                                <span
                                  className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-black transition-all duration-300 ${
                                    isHovered
                                      ? "bg-[#ff8a3d] text-white ring-4 ring-orange-200 scale-110 shadow-md"
                                      : "bg-white border-2 border-indigo-600 text-indigo-700 shadow-xs group-hover:border-[#ff8a3d] group-hover:text-[#ff8a3d]"
                                  }`}
                                >
                                  {st.step}
                                </span>
                              </div>

                              {/* Phase Badge */}
                              <span className="text-[11px] font-black uppercase tracking-wider text-[#ea580c] mb-1">
                                Phase {idx + 1}
                              </span>

                              {/* Heading down the step (NO CARD STYLE) */}
                              <h4 className="hover-heading text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors px-1">
                                {st.title}
                              </h4>

                              {/* Sub-context shown on hover & mobile visible */}
                              <div
                                className={`mt-2 transition-all duration-300 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200/80 shadow-xs max-w-[280px] md:max-w-[210px] ${
                                  isHovered
                                    ? "opacity-100 translate-y-0"
                                    : "block md:opacity-0 md:-translate-y-1 md:pointer-events-none md:invisible md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:visible"
                                }`}
                              >
                                <p className="leading-relaxed">
                                  {qualityStepDescriptions[idx]}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 5: THE PEOPLE BEHIND HOMECAREX (CAROUSEL WITH ICONS BESIDE HEADINGS) ================= */}
              {activeTab === "team" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {team.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        {team.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {team.subtitle}
                      </p>
                      <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                        "{team.intro}"
                      </div>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-service-crew.jpg"
                          alt="HomeCareX cross-functional operations and engineering team"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Multidisciplinary teams building the next-gen marketplace.
                      </p>
                    </div>
                  </div>

                  {/* 4th Image: Cross-Functional Disciplines Carousel Animation */}
                  <div
                    className="pt-6 border-t border-slate-100"
                    onMouseEnter={() => setIsTeamPaused(true)}
                    onMouseLeave={() => setIsTeamPaused(false)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                        <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                          Cross-Functional Disciplines:
                        </h3>
                      </div>

                      {/* Carousel Controls */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 mr-2">
                          {teamCarouselSlide + 1} / 2
                        </span>
                        <button
                          type="button"
                          aria-label="Previous disciplines"
                          onClick={() => setTeamCarouselSlide((prev) => (prev === 0 ? 1 : 0))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition shadow-2xs cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next disciplines"
                          onClick={() => setTeamCarouselSlide((prev) => (prev === 1 ? 0 : 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition shadow-2xs cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Animated 2-Column Carousel with Icons Beside Headings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {team.disciplines
                        .slice(teamCarouselSlide * 2, teamCarouselSlide * 2 + 2)
                        .map((disc, idx) => {
                          const iconList = [
                            <Laptop key="lap" className="h-5 w-5 text-indigo-600" />,
                            <Settings key="set" className="h-5 w-5 text-orange-600" />,
                            <Headphones key="hed" className="h-5 w-5 text-emerald-600" />,
                            <ShieldCheck key="shd" className="h-5 w-5 text-blue-600" />,
                          ];
                          const iconIndex = teamCarouselSlide * 2 + idx;
                          return (
                            <div
                              key={disc.id}
                              className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-indigo-400 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                            >
                              {/* Icon Beside Heading */}
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs group-hover:bg-indigo-50 group-hover:scale-105 transition-all">
                                    {iconList[iconIndex] || <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                                  </span>
                                  <div>
                                    <h4 className="group-hover-heading text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                      {disc.title}
                                    </h4>
                                    <p className="text-xs sm:text-sm font-bold text-indigo-600">
                                      {disc.scope}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                                  Discipline
                                </span>
                              </div>

                              <div className="border-t border-slate-100 pt-3">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                  FOCUS AREAS:
                                </p>
                                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600">
                                  {disc.focusAreas.map((fa) => (
                                    <li key={fa} className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" />
                                      <span>{fa}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Carousel Slide Indicators */}
                    <div className="flex items-center justify-center gap-2 mt-5">
                      <button
                        type="button"
                        aria-label="Slide 1"
                        onClick={() => setTeamCarouselSlide(0)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          teamCarouselSlide === 0 ? "w-7 bg-[#4338ca]" : "w-2 bg-slate-200 hover:bg-slate-300"
                        }`}
                      />
                      <button
                        type="button"
                        aria-label="Slide 2"
                        onClick={() => setTeamCarouselSlide(1)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          teamCarouselSlide === 1 ? "w-7 bg-[#4338ca]" : "w-2 bg-slate-200 hover:bg-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 6: OUR CORE VALUES (3RD IMAGE: REFINED EXECUTIVE PROFESSIONAL STYLE) ================= */}
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

              {/* ================= TAB 7: THE 4-STEP CUSTOMER JOURNEY (STEPPER & HOVER STYLE) ================= */}
              {activeTab === "marketplace" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-7 space-y-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700">
                        <span className="h-2 w-2 rounded-full bg-[#ff8a3d]" />
                        {howItWorks.eyebrow}
                      </span>
                      <h2 className="hover-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight cursor-default">
                        {howItWorks.heading}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                        {howItWorks.subtitle}
                      </p>
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        A structured digital workflow connecting homeowners with verified professionals for seamless service completion.
                      </p>
                    </div>

                    <div className="md:col-span-5 shrink-0">
                      <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-100 aspect-[4/3] bg-slate-100 group">
                        <img
                          src="/images/about/about-cleaning-team.jpg"
                          alt="HomeCareX customer scheduling a verified service"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center font-medium">
                        Seamless booking and doorstep delivery in 4 steps.
                      </p>
                    </div>
                  </div>

                  {/* 2nd Image: The 4-Step Customer Journey (CONNECTED STEPPER, NO CARD STYLE) */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-8">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff8a3d]" />
                      <h3 className="hover-heading text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#4338ca] cursor-default">
                        The 4-Step Customer Journey:
                      </h3>
                    </div>

                    {/* Connected Stepper with Steps Directly Underneath (Zero Card Boxes) */}
                    <div className="relative py-2">
                      {/* Base Track strictly between node 01 center (12.5%) and node 04 center (87.5%) */}
                      <div className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-1 bg-slate-200 -z-0 rounded-full" />
                      {/* Active Progress Track capped strictly at node 04 */}
                      <div
                        className="hidden md:block absolute top-6 left-[12.5%] h-1 bg-gradient-to-r from-indigo-600 via-[#ff8a3d] to-emerald-500 -z-0 rounded-full transition-all duration-500"
                        style={{
                          width:
                            hoveredJourneyStep !== null
                              ? `${(hoveredJourneyStep / 3) * 75}%`
                              : "75%",
                          maxWidth: "75%", // STRICT BOUND: Never crosses or overshoots past step 4!
                        }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
                        {howItWorks.steps.map((st, idx) => {
                          const isHovered = hoveredJourneyStep === idx;
                          return (
                            <div
                              key={st.number}
                              className="group flex flex-col items-center text-center cursor-pointer relative px-2"
                              onMouseEnter={() => setHoveredJourneyStep(idx)}
                              onMouseLeave={() => setHoveredJourneyStep(null)}
                              onClick={() => setHoveredJourneyStep(hoveredJourneyStep === idx ? null : idx)}
                            >
                              {/* Step Node */}
                              <div className="relative z-10 mb-3">
                                <span
                                  className={`flex h-12 w-12 items-center justify-center rounded-full text-xs font-black transition-all duration-300 ${
                                    isHovered
                                      ? "bg-[#ff8a3d] text-white ring-4 ring-orange-200 scale-110 shadow-md"
                                      : "bg-white border-2 border-indigo-600 text-indigo-700 shadow-xs group-hover:border-[#ff8a3d] group-hover:text-[#ff8a3d]"
                                  }`}
                                >
                                  {st.number}
                                </span>
                              </div>

                              {/* Step Label */}
                              <span className="text-[11px] font-black uppercase tracking-wider text-[#ea580c] mb-1">
                                Step {st.number}
                              </span>

                              {/* Step Title with Icon */}
                              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                <h4 className="hover-heading text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {st.title}
                                </h4>
                                <span className="text-base">{st.icon}</span>
                              </div>

                              {/* Summary */}
                              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                                {st.summary}
                              </p>

                              {/* Subpoints revealed on hover (NO CARD STYLE) & mobile touch visible */}
                              <div
                                className={`transition-all duration-300 overflow-hidden text-left ${
                                  isHovered
                                    ? "max-h-60 opacity-100 mt-3 pt-3 border-t border-slate-100"
                                    : "block md:max-h-0 md:opacity-0 md:group-hover:max-h-60 md:group-hover:opacity-100 md:group-hover:mt-3 md:group-hover:pt-3 md:group-hover:border-t md:group-hover:border-slate-100 mt-3 pt-3 border-t border-slate-100"
                                }`}
                              >
                                <ul className="space-y-1.5 text-xs text-slate-600">
                                  {st.details.map((d) => (
                                    <li key={d} className="flex items-center gap-2">
                                      <CheckCircle2
                                        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                                          isHovered ? "text-[#ff8a3d]" : "text-emerald-500"
                                        }`}
                                      />
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Subtle hint when idle (Desktop only) */}
                              <div className="hidden md:flex mt-2 pt-1 text-[11px] font-semibold text-slate-400 group-hover:hidden items-center gap-1">
                                <span>View details</span>
                                <span>&rarr;</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Link
                      to={ROUTES.SERVICES}
                      className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-[#ff8a3d] hover:text-[#ea580c] transition-colors cursor-pointer"
                    >
                      <span>Explore Our Services Catalog</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
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
        className="py-10 sm:py-14 bg-gradient-to-b from-white to-slate-50 border-t border-slate-200/70"
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

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
                <Link
                  to={cta.primaryCta?.href || ROUTES.SERVICES}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ff8a3d] px-7 py-3 text-sm sm:text-base font-bold text-white shadow-md shadow-orange-500/20 transition hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <span>{cta.primaryCta?.label || "Explore Services"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={cta.secondaryCta?.href || ROUTES.PARTNER_REGISTER}
                  className="inline-flex items-center justify-center rounded-xl border-2 border-[#4338ca] bg-white px-7 py-3 text-sm sm:text-base font-bold text-[#4338ca] shadow-xs transition hover:bg-indigo-50 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <span>{cta.secondaryCta?.label || "Become a Partner"}</span>
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
