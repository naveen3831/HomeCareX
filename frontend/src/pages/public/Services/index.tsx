import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  BadgePercent,
  Clock,
  CheckCircle2,
  AlertCircle,
  SearchX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useCategories } from "@/features/public/hooks";
import { serviceImageFor } from "@/lib/serviceImage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import OfflineState from "@/components/common/OfflineState";
import {
  QUERY_LIMITS,
  parseServicesQuery,
  sanitizeSearchText,
  toServicesSearchParams,
  uiSortToApi,
} from "@/lib/querySanitize";
import type {
  ServiceListParams,
  ServiceSort,
} from "@/types/catalog";

import ServiceCard from "../../../components/public/ServiceCard";
import ServiceCardSkeleton from "../../../components/public/ServiceCardSkeleton";
import ServiceFilters, {
  SortOption,
} from "../../../components/public/ServiceFilters";
import Pagination from "../../../components/public/Pagination";
import Seo from "../../../components/common/Seo";
import { breadcrumbLd } from "../../../lib/jsonld";
import { slugToTitle } from "../../../lib/seo";

// ============================================================
// ITEMS PER PAGE & CONSTANTS
// ============================================================

const ITEMS_PER_PAGE = 6;
const SEARCH_DEBOUNCE_MS = 300;
const CAROUSEL_INTERVAL_MS = 4000;

const WHY_CHOOSE_PILLARS = [
  {
    id: "professionals",
    tabLabel: "Verified Pros",
    icon: ShieldCheck,
    theme: {
      bg: "bg-indigo-600",
      accentText: "text-indigo-600",
      pillBg: "bg-indigo-50",
      pillBorder: "border-indigo-100",
      gradient: "from-indigo-50/70 via-white to-purple-50/30",
      border: "border-indigo-100/90",
      badgeText: "text-indigo-700",
    },
    stat: "4.9★ Rated",
    title: "Trusted Professionals",
    description: "Experienced service professionals ready to help with your everyday home needs.",
    bullets: [
      "100% Police & Identity verified",
      "5+ years certified trade experience",
      "Standardized safety & equipment",
    ],
    guarantee: "🛡️ Verified Experts Guarantee",
  },
  {
    id: "pricing",
    tabLabel: "Fair Pricing",
    icon: BadgePercent,
    theme: {
      bg: "bg-[#f97316]",
      accentText: "text-[#f97316]",
      pillBg: "bg-orange-50",
      pillBorder: "border-orange-100",
      gradient: "from-orange-50/70 via-white to-amber-50/30",
      border: "border-orange-100/90",
      badgeText: "text-[#f97316]",
    },
    stat: "Zero Surprises",
    title: "Transparent Pricing",
    description: "View starting prices and service details before choosing the right service for your home.",
    bullets: [
      "Fixed, standardized rate cards",
      "Free upfront quotes with no hidden fees",
      "Pay securely after job completion",
    ],
    guarantee: "💳 Best Value & Fair Price",
  },
  {
    id: "convenience",
    tabLabel: "On-Time Care",
    icon: Clock,
    theme: {
      bg: "bg-teal-600",
      accentText: "text-teal-600",
      pillBg: "bg-teal-50",
      pillBorder: "border-teal-100",
      gradient: "from-teal-50/70 via-white to-emerald-50/30",
      border: "border-teal-100/90",
      badgeText: "text-teal-700",
    },
    stat: "On-Time Arrival",
    title: "Convenient Home Services",
    description: "Find cleaning, plumbing, electrical, appliance repair, painting, and maintenance in one place.",
    bullets: [
      "Same-day & flexible slot booking",
      "Live real-time expert tracking",
      "30-day hassle-free service warranty",
    ],
    guarantee: "⚡ Doorstep Service Guarantee",
  },
];

// ============================================================
// SERVICES PAGE
// ============================================================

export const ServicesPage: React.FC = () => {
  // ==========================================================
  // URL SEARCH PARAMS
  // ==========================================================

  const [searchParams, setSearchParams] = useSearchParams();

  const {
    q: search,
    category,
    sort,
    page: currentPage,
    pincode,
    dirty: urlWasTampered,
  } = parseServicesQuery(searchParams);

  // Rewrite address bar if URL was tampered
  useEffect(() => {
    if (!urlWasTampered) return;

    setSearchParams(
      toServicesSearchParams(
        { q: search, category, sort, page: currentPage, pincode },
        searchParams
      ),
      { replace: true }
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWasTampered, searchParams]);

  const apiSort: ServiceSort = uiSortToApi(sort);

  const serviceParams: ServiceListParams = {
    q: search || undefined,
    category: category || undefined,
    sort: apiSort,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  };

  const servicesQuery = useServices(serviceParams);

  const categoriesQuery = useCategories();
  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({
    label: c.name,
    value: c.slug,
  }));

  const online = useOnlineStatus();

  const showOffline =
    !online &&
    (servicesQuery.isPending || servicesQuery.isError) &&
    !servicesQuery.data;

  const loading = servicesQuery.isPending;
  const error = servicesQuery.isError;

  const apiServices = servicesQuery.data?.items ?? [];
  const totalPages = servicesQuery.data?.meta.totalPages ?? 0;
  const safeCurrentPage = servicesQuery.data?.meta.page ?? currentPage;

  // Search input state
  const [searchInput, setSearchInput] = useState(search);
  const [pincodeInput, setPincodeInput] = useState(pincode);

  // Mobile Pillar Carousel State
  const [mobilePillarTab, setMobilePillarTab] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Auto-rotate mobile carousel animation
  useEffect(() => {
    if (isCarouselPaused) return;

    const timer = setInterval(() => {
      setMobilePillarTab((prev) => (prev + 1) % WHY_CHOOSE_PILLARS.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setPincodeInput(pincode);
  }, [pincode]);

  // Debounced search
  useEffect(() => {
    const cleaned = sanitizeSearchText(searchInput);

    if (cleaned === search) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);

        if (cleaned) {
          params.set("q", cleaned);
        } else {
          params.delete("q");
        }

        params.set("page", "1");

        return params;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value.slice(0, QUERY_LIMITS.q));
  };

  const handleCategoryChange = (value: string) => {
    updateParams({
      category: value,
      page: "1",
    });
  };

  const handleSortChange = (value: SortOption) => {
    updateParams({
      sort: value,
      page: "1",
    });
  };

  const handlePincodeChange = (value: string) => {
    setPincodeInput(value);
    if (value === "" || value.length === 6) {
      updateParams({
        pincode: value,
        page: "1",
      });
    }
  };

  const handleClear = () => {
    setSearchInput("");
    setPincodeInput("");
    setSearchParams({});
  };

  const handleRetry = () => {
    void servicesQuery.refetch();
  };

  const handlePageChange = (page: number) => {
    updateParams({
      page: String(page),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // SEO
  const categoryName = category ? slugToTitle(category) : "";

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#f8faff] via-[#ffffff] to-[#f4f7ff] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Ambient background decorative glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-72 w-full max-w-5xl bg-gradient-to-r from-indigo-200/25 via-blue-100/20 to-orange-100/25 blur-3xl"
        aria-hidden="true"
      />

      <Seo
        title={
          categoryName
            ? `${categoryName} Services | HomeCareX`
            : "All Home Services | HomeCareX"
        }
        description={
          categoryName
            ? `Book trusted ${categoryName.toLowerCase()} professionals near you. Compare prices, durations and book online with HomeCareX.`
            : "Browse and book home cleaning, plumbing, electrical, painting, appliance repair and maintenance services with HomeCareX."
        }
        category={category || undefined}
        jsonLd={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          ...(categoryName
            ? [
                {
                  name: categoryName,
                  path: `/services?category=${encodeURIComponent(category)}`,
                },
              ]
            : []),
        ])}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* ====================================================
            PAGE HEADER (Compact, Vibrant & Aesthetic)
        ==================================================== */}
        <header className="mb-6 text-center sm:mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100/80 bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 shadow-2xs backdrop-blur-md">
            <Sparkles size={12} className="text-[#f97316]" />
            <span>Discover & Book Services</span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            Find the{" "}
            <span className="text-indigo-600">
              Right Service
            </span>{" "}
            for Your Home
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-slate-600 font-medium">
            Browse verified doorstep home services with transparent pricing,
            certified professionals, and guaranteed quality.
          </p>
        </header>

        {/* ====================================================
            FILTERS COMPONENT (Search, Categories, Drawer)
        ==================================================== */}
        <ServiceFilters
          q={searchInput}
          categories={categoryOptions}
          category={category}
          sort={sort}
          pincode={pincodeInput}
          onQueryChange={handleSearchChange}
          onCategoryChange={handleCategoryChange}
          onSortChange={handleSortChange}
          onPincodeChange={handlePincodeChange}
          onClear={handleClear}
        />

        {/* ====================================================
            RESULT COUNT & STATUS BAR
        ==================================================== */}
        <div className="mb-4 flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Showing{" "}
              <strong className="text-slate-800">
                {servicesQuery.data?.meta.total ?? 0}
              </strong>{" "}
              {(servicesQuery.data?.meta.total ?? 0) === 1
                ? "service"
                : "services"}{" "}
              found
            </span>
          </p>

          {category && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
              {categoryName || category}
            </span>
          )}
        </div>

        {/* ====================================================
            SERVICE GRID / OFFLINE / LOADING / ERROR / EMPTY
        ==================================================== */}
        {showOffline ? (
          <OfflineState onRetry={handleRetry} />
        ) : loading ? (
          <div
            className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-busy="true"
            aria-label="Loading services"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <ServiceCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xs sm:p-12"
            role="alert"
          >
            <div className="mx-auto max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle size={24} />
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Unable to load services
              </h2>

              <p className="mt-1.5 text-xs text-slate-500">
                Something went wrong while fetching the service catalog. Please
                try again.
              </p>

              <button
                type="button"
                onClick={handleRetry}
                className="mt-5 rounded-xl bg-gradient-to-r from-[#4338ca] to-[#3730a3] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95"
              >
                Retry
              </button>
            </div>
          </div>
        ) : apiServices.length > 0 ? (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {apiServices.map((service, idx) => {
              const fallback = serviceImageFor(service.name);
              const image = service.image || fallback;

              return (
                <ServiceCard
                  key={service.id}
                  id={service.slug}
                  image={image}
                  fallbackImage={fallback}
                  category={service.category.name}
                  name={service.name}
                  rating={service.rating}
                  price={service.basePrice}
                  duration={`${service.durationMinutes} min`}
                  priority={idx < 3}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs sm:p-12">
            <div className="mx-auto max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <SearchX size={24} />
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                No services found
              </h2>

              <p className="mt-1.5 text-xs text-slate-500">
                Try searching with different keywords or clear your current filters.
              </p>

              <button
                type="button"
                onClick={handleClear}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#4338ca] to-[#3730a3] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            PAGINATION
        ==================================================== */}
        {!showOffline && !loading && !error && apiServices.length > 0 && (
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* ====================================================
            WHY CHOOSE HOMECAREX SECTION
            Desktop: Full-Width 3-Column Rich Cards (>= 768px)
            Mobile: Animated Smooth Carousel with Auto-Rotate (< 768px)
        ==================================================== */}
        <section className="mt-10 sm:mt-12 overflow-hidden rounded-3xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/30 to-orange-50/25 p-5 sm:p-8 lg:p-10 shadow-xs">
          {/* Section Header */}
          <div className="w-full text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/95 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 shadow-2xs">
              <Sparkles size={11} className="text-[#f97316]" />
              <span>Why Choose HomeCareX</span>
            </div>

            <h2 className="mt-2.5 text-xl font-black tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
              Professional services for every home
            </h2>

            <p className="mx-auto mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-600 font-medium">
              HomeCareX connects you with verified professionals for reliable,
              transparent, and hassle-free doorstep home services.
            </p>
          </div>

          {/* --------------------------------------------------
              MOBILE VIEW: Animated Smooth Carousel (< 768px)
          -------------------------------------------------- */}
          <div className="mt-5 block md:hidden">
            {/* Interactive Pill Tabs with Slide Sync */}
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100/90 p-1 shadow-2xs">
              {WHY_CHOOSE_PILLARS.map((p, idx) => {
                const Icon = p.icon;
                const isActive = mobilePillarTab === idx;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setMobilePillarTab(idx);
                      setIsCarouselPaused(true);
                    }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon
                      size={14}
                      className={isActive ? p.theme.accentText : "text-slate-400"}
                    />
                    <span className="truncate">{p.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Sliding Carousel Track Container */}
            <div
              className="relative mt-3"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
              onTouchStart={() => setIsCarouselPaused(true)}
              onTouchEnd={() => setIsCarouselPaused(false)}
            >
              {/* Overflow Hidden Track Window */}
              <div className="overflow-hidden rounded-2xl">
                {/* Sliding Track with Smooth Transform Animation */}
                <div
                  className="flex transition-transform duration-500 ease-out will-change-transform"
                  style={{ transform: `translateX(-${mobilePillarTab * 100}%)` }}
                >
                  {WHY_CHOOSE_PILLARS.map((pillar) => {
                    const PillarIcon = pillar.icon;
                    return (
                      <div
                        key={pillar.id}
                        className="w-full shrink-0"
                      >
                        <div
                          className={`rounded-2xl border ${pillar.theme.border} bg-gradient-to-br ${pillar.theme.gradient} p-4 sm:p-5 shadow-2xs`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pillar.theme.bg} text-white shadow-2xs`}
                              >
                                <PillarIcon size={20} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                                  {pillar.title}
                                </h3>
                                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                                  {pillar.description}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full bg-white/95 border ${pillar.theme.pillBorder} px-2 py-0.5 text-[10px] font-extrabold ${pillar.theme.badgeText} shadow-2xs`}
                            >
                              {pillar.stat}
                            </span>
                          </div>

                          {/* 2 Feature Bullets */}
                          <ul className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-2.5 text-xs text-slate-700">
                            {pillar.bullets.slice(0, 2).map((bullet, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <CheckCircle2
                                  size={13}
                                  className={`${pillar.theme.accentText} shrink-0`}
                                />
                                <span className="text-[11px] font-medium leading-tight">
                                  {bullet}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {/* Guarantee Banner */}
                          <div className="mt-3 rounded-lg bg-white/90 border border-slate-200/60 py-1.5 px-3 text-center text-[10px] font-bold text-slate-700 shadow-2xs">
                            {pillar.guarantee}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prev Carousel Navigation Button (Positioned outwards) */}
              <button
                type="button"
                onClick={() => {
                  setMobilePillarTab(
                    (prev) => (prev - 1 + WHY_CHOOSE_PILLARS.length) % WHY_CHOOSE_PILLARS.length
                  );
                  setIsCarouselPaused(true);
                }}
                aria-label="Previous feature"
                className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 transition-all active:scale-90 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Next Carousel Navigation Button (Positioned outwards) */}
              <button
                type="button"
                onClick={() => {
                  setMobilePillarTab((prev) => (prev + 1) % WHY_CHOOSE_PILLARS.length);
                  setIsCarouselPaused(true);
                }}
                aria-label="Next feature"
                className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 transition-all active:scale-90 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Carousel Animated Dots Indicator */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {WHY_CHOOSE_PILLARS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setMobilePillarTab(idx);
                    setIsCarouselPaused(true);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    mobilePillarTab === idx
                      ? "w-6 bg-gradient-to-r from-indigo-600 to-[#f97316]"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* --------------------------------------------------
              DESKTOP VIEW: Full-Width 3-Column Rich Cards (>= 768px)
          -------------------------------------------------- */}
          <div className="mt-8 hidden md:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 text-left">
            {WHY_CHOOSE_PILLARS.map((pillar) => {
              const PillarIcon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className={`group flex flex-col justify-between rounded-2xl border ${pillar.theme.border} bg-gradient-to-br ${pillar.theme.gradient} p-5 sm:p-6 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${pillar.theme.bg} text-white shadow-xs transition-transform group-hover:scale-105`}
                      >
                        <PillarIcon size={24} />
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border ${pillar.theme.pillBorder} bg-white/90 px-2.5 py-1 text-[11px] font-bold ${pillar.theme.badgeText} shadow-2xs`}
                      >
                        <CheckCircle2 size={12} className={pillar.theme.accentText} />
                        <span>{pillar.stat}</span>
                      </span>
                    </div>

                    <h3 className="mt-4 text-base sm:text-lg font-extrabold text-slate-900">
                      {pillar.title}
                    </h3>

                    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 font-normal">
                      {pillar.description}
                    </p>

                    <ul className="mt-4 space-y-2 border-t border-slate-200/60 pt-4 text-xs font-medium text-slate-700">
                      {pillar.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2
                            size={14}
                            className={`${pillar.theme.accentText} shrink-0`}
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-xl bg-white/80 border border-slate-200/80 px-3 py-2 text-center text-xs font-bold text-slate-700 shadow-2xs">
                    {pillar.guarantee}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};

export default ServicesPage;
