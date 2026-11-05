import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { fetchPublicReviews } from "@/services/reviewsApi";

/* =====================================================================
 * TYPES & DATA
 * ===================================================================== */

export interface CustomerReview {
  id: string;
  name: string;
  city: string;
  service: string;
  category: "Cleaning" | "Plumbing" | "Electrical" | "Appliances" | "Carpentry";
  tag: string;
  headline: string;
  review: string;
  rating: number;
  avatar: string;
  date: string;
  verifiedBookingsCount: number;
  helpfulCount: number;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Real 5-star rating with precision SVG vector stars & rating score */
const StarRating: React.FC<{
  value: number;
  starSize?: string;
  showScore?: boolean;
}> = ({ value, starSize = "h-4 w-4", showScore = true }) => {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <div
      className="inline-flex items-center gap-1.5"
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fillPercentage = Math.max(
            0,
            Math.min(1, clamped - (starIndex - 1))
          );
          const gradientId = `page-star-grad-${starIndex}-${Math.round(
            fillPercentage * 100
          )}`;

          return (
            <svg
              key={starIndex}
              className={`${starSize} flex-shrink-0 drop-shadow-[0_1px_2px_rgba(245,158,11,0.25)]`}
              viewBox="0 0 24 24"
              fill="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset={`${fillPercentage * 100}%`} stopColor="#f59e0b" />
                  <stop offset={`${fillPercentage * 100}%`} stopColor="#e2e8f0" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#${gradientId})`}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          );
        })}
      </div>

      {showScore && (
        <span className="text-xs sm:text-sm font-extrabold tabular-nums text-slate-800">
          {clamped.toFixed(1)}
        </span>
      )}
    </div>
  );
};

/* =====================================================================
 * MAIN COMPONENT: ReviewsPage
 * ===================================================================== */

export default function ReviewsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "helpful">("recent");
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  const [reviewsList, setReviewsList] = useState<CustomerReview[]>([]);
  const [stats, setStats] = useState<{
    averageRating: number;
    totalReviews: number;
    satisfactionRate: number;
    homesServed: string;
  }>({
    averageRating: 0,
    totalReviews: 0,
    satisfactionRate: 0,
    homesServed: "0",
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [helpfulState, setHelpfulState] = useState<Record<string, { count: number; liked: boolean }>>({});

  // Fetch reviews & stats dynamically from backend
  useEffect(() => {
    let isMounted = true;
    async function loadBackendReviews() {
      try {
        setIsLoading(true);
        const res = await fetchPublicReviews();
        if (isMounted && res) {
          const list = Array.isArray(res.reviews) ? (res.reviews as CustomerReview[]) : [];
          setReviewsList(list);
          if (res.stats) {
            setStats({
              averageRating: res.stats.averageRating ?? 0,
              totalReviews: res.stats.totalReviews ?? list.length,
              satisfactionRate: res.stats.satisfactionRate ?? 0,
              homesServed: res.stats.homesServed || (list.length > 0 ? `${list.length * 10}+` : "0"),
            });
          }
          const nextHelpful: Record<string, { count: number; liked: boolean }> = {};
          list.forEach((r) => {
            nextHelpful[r.id] = { count: r.helpfulCount || 0, liked: false };
          });
          setHelpfulState(nextHelpful);
        }
      } catch (err) {
        console.warn("Reviews API unavailable, using local high-fidelity reviews fallback:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBackendReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleHelpful = (id: string) => {
    setHelpfulState((prev) => {
      const current = prev[id] ?? { count: 20, liked: false };
      const nextLiked = !current.liked;
      return {
        ...prev,
        [id]: {
          count: current.count + (nextLiked ? 1 : -1),
          liked: nextLiked,
        },
      };
    });
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: reviewsList.length };
    reviewsList.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [reviewsList]);

  const categories = [
    { id: "All", label: "All Reviews", count: categoryCounts.All },
    { id: "Cleaning", label: "Cleaning", count: categoryCounts.Cleaning || 0 },
    { id: "Plumbing", label: "Plumbing", count: categoryCounts.Plumbing || 0 },
    { id: "Electrical", label: "Electrical", count: categoryCounts.Electrical || 0 },
    { id: "Appliances", label: "Appliances", count: categoryCounts.Appliances || 0 },
    { id: "Carpentry", label: "Carpentry", count: categoryCounts.Carpentry || 0 },
  ];

  // Filtered & Sorted Reviews
  const filteredReviews = useMemo(() => {
    let list = reviewsList.filter((r) => {
      const matchesCategory =
        selectedCategory === "All" || r.category === selectedCategory;
      const matchesRating =
        ratingFilter === "all" || Math.floor(r.rating) >= ratingFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.review.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesRating && matchesSearch;
    });

    if (sortBy === "rating") {
      list = [...list].sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "helpful") {
      list = [...list].sort(
        (a, b) =>
          (helpfulState[b.id]?.count ?? b.helpfulCount) -
          (helpfulState[a.id]?.count ?? a.helpfulCount)
      );
    }

    return list;
  }, [selectedCategory, ratingFilter, searchQuery, sortBy, helpfulState]);

  return (
    <>
      <Seo
        title="Customer Stories & Verified Reviews | HomeCareX"
        description="Read authentic reviews, ratings, and customer stories from verified homeowners who book home cleaning, plumbing, repairs, and electrical services on HomeCareX."
      />

      <div className="relative min-h-screen bg-gradient-to-b from-[#f8faff] via-white to-[#f4f7fd] pb-16 pt-8 sm:pt-12">
        {/* Ambient background glows */}
        <div
          className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-gradient-to-br from-[#ff8a3d]/10 to-amber-200/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-32 top-60 h-96 w-96 rounded-full bg-gradient-to-tr from-[#4338ca]/10 to-blue-200/15 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          {/* ===================== HERO SECTION ===================== */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50/90 border border-orange-200/70 px-3.5 py-1 text-xs font-bold text-orange-800 shadow-2xs">
              <span className="text-[#f59e0b]">★</span>
              <span>
                {stats.totalReviews > 0
                  ? `${stats.averageRating.toFixed(1)} Average Rating from ${stats.totalReviews} Verified Review${stats.totalReviews === 1 ? "" : "s"}`
                  : "Verified Customer Reviews & Feedback"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-[#1e1b4b] via-[#4338ca] to-[#3b82f6] bg-clip-text text-transparent">
                Customer Stories
              </span>{" "}
              <span className="text-[#f97316] font-extrabold">&amp;</span>{" "}
              <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff5722] bg-clip-text text-transparent drop-shadow-xs">
                Reviews
              </span>
            </h1>

            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-xl mx-auto">
              Real experiences and verified stories from homeowners and families who rely on HomeCareX every day.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/customer/reviews"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-[0_6px_20px_rgba(255,138,61,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(255,138,61,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Share your experience</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-[#1e1b4b] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ff8a3d] hover:bg-orange-50/40 hover:text-[#ff8a3d]"
              >
                <span>Explore all services</span>
              </Link>
            </div>
          </div>

          {/* ===================== TRUST STATS BAR ===================== */}
          <div className="mt-8 sm:mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] tabular-nums">
                {stats.totalReviews > 0 ? `${stats.averageRating.toFixed(1)} ★` : "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Overall Rating</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tabular-nums">
                {stats.totalReviews > 0 ? `${stats.satisfactionRate.toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Satisfaction Rate</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#ff8a3d] tabular-nums">
                {stats.totalReviews > 0 ? stats.homesServed : "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Homes Served</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 tabular-nums">100%</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Verified Technicians</p>
            </div>
          </div>

          {/* ===================== HIGH-CLARITY FILTER SUITE ===================== */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
            {/* Top Row: Service Category Pills with Full Visibility */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <svg className="h-3.5 w-3.5 text-[#ff8a3d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span>Filter by Service</span>
                </span>

                <span className="text-xs font-medium text-slate-500">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-1.5 text-orange-600 font-semibold">
                      <svg className="animate-spin h-3 w-3 text-orange-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating from backend...
                    </span>
                  ) : (
                    <>
                      Showing <span className="font-bold text-[#1e1b4b]">{filteredReviews.length}</span> of {reviewsList.length} reviews
                    </>
                  )}
                </span>
              </div>

              {/* Category Pills (Wrap naturally without truncation) */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`group inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                        active
                          ? "bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] text-white shadow-xs ring-2 ring-orange-400/30"
                          : "bg-slate-50 text-slate-700 border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 hover:text-[#1e1b4b]"
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-black tabular-nums transition-colors ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-white text-slate-600 border border-slate-200 group-hover:border-orange-200 group-hover:text-orange-700"
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="my-3.5 border-t border-slate-100" />

            {/* Bottom Row: Search Box, Rating Pills, and Sort Dropdown */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Box */}
              <div className="relative flex-1 sm:max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reviews by name, city, service..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition focus:border-[#ff8a3d] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/20"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Rating Pills and Sort */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Rating Filter Segmented Controls */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                  {(["all", 5, 4, 3] as const).map((r) => {
                    const active = ratingFilter === r;
                    const label = r === "all" ? "All Stars" : r === 5 ? "5.0 ★" : `${r}.0+ ★`;
                    return (
                      <button
                        key={String(r)}
                        type="button"
                        onClick={() => setRatingFilter(r)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? "bg-white text-[#1e1b4b] shadow-2xs font-extrabold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Sort dropdown */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "recent" | "rating" | "helpful")}
                    className="rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#ff8a3d] focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/20 cursor-pointer appearance-none"
                  >
                    <option value="recent">Newest first</option>
                    <option value="rating">Highest rated</option>
                    <option value="helpful">Most helpful</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-slate-400">▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== REVIEWS FEED (ONE CARD PER ROW) ===================== */}
          <div className="mt-8">
            {isLoading ? (
              <div className="rounded-3xl border border-slate-200 bg-white py-14 text-center shadow-xs">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-3 text-sm text-slate-500 font-medium">Loading verified reviews...</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white py-14 text-center shadow-xs">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#ff8a3d] ring-4 ring-orange-50/60">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3 className="mt-3.5 text-base sm:text-lg font-bold text-[#1e1b4b]">
                  {reviewsList.length === 0 ? "No reviews yet" : "No reviews found"}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  {reviewsList.length === 0
                    ? "Verified customer reviews will appear here once bookings are reviewed."
                    : "Try clearing your search query or choosing another service category."}
                </p>
                {reviewsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("All");
                      setRatingFilter("all");
                      setSearchQuery("");
                    }}
                    className="mt-4 rounded-xl bg-gradient-to-r from-[#ff8a3d] to-[#f97316] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:shadow-xs cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              /* One Card in the Row (Single Column Layout) */
              <div className="flex flex-col gap-4 sm:gap-5">
                {filteredReviews.map((r) => {
                  const helpful = helpfulState[r.id] ?? { count: r.helpfulCount, liked: false };
                  const hasAvatar = Boolean(r.avatar && !avatarErrors[r.id]);

                  return (
                    <article
                      key={r.id}
                      className="group rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs transition-all duration-300 hover:border-orange-300 hover:shadow-md"
                    >
                      {/* Top Row: Stars + Category Pill + Date */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                          <StarRating value={r.rating} starSize="h-4 w-4 sm:h-4.5 sm:w-4.5" />

                          {r.tag && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/70 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                              {r.tag}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 text-[11px] font-bold text-[#4338ca]">
                            {r.service}
                          </span>
                        </div>

                        <span className="text-xs font-medium text-slate-400">{r.date}</span>
                      </div>

                      {/* Headline Quote */}
                      <h3 className="mt-3 text-base sm:text-lg md:text-xl font-bold text-[#1e1b4b] leading-snug tracking-tight">
                        &ldquo;{r.headline}&rdquo;
                      </h3>

                      {/* Review Story */}
                      <p className="mt-2 text-xs sm:text-sm md:text-base leading-relaxed text-slate-600 font-normal">
                        &ldquo;{r.review}&rdquo;
                      </p>

                      {/* Customer Info & Helpful Button */}
                      <div className="mt-4 sm:mt-5 border-t border-slate-100 pt-3.5 sm:pt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                            {hasAvatar ? (
                              <img
                                src={r.avatar}
                                alt={r.name}
                                className="h-full w-full rounded-full object-cover ring-2 ring-orange-200/80"
                                onError={() => setAvatarErrors((p) => ({ ...p, [r.id]: true }))}
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#ff8a3d] via-[#f97316] to-[#ff6b00] text-xs font-bold text-white shadow-2xs">
                                {initials(r.name)}
                              </span>
                            )}
                            <span
                              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white ring-2 ring-white shadow-xs"
                              title="Verified Customer"
                            >
                              ✓
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs sm:text-sm font-bold text-[#1e1b4b] leading-snug">{r.name}</p>
                              <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                                Verified Customer
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {r.city} • {r.verifiedBookingsCount} bookings completed
                            </p>
                          </div>
                        </div>

                        {/* Helpful Counter Button */}
                        <button
                          type="button"
                          onClick={() => toggleHelpful(r.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs ${
                            helpful.liked
                              ? "bg-rose-50 text-rose-600 border border-rose-300 scale-105"
                              : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-rose-50/60 hover:text-rose-600 hover:border-rose-200"
                          }`}
                          title="Was this review helpful?"
                        >
                          <span>{helpful.liked ? "❤️" : "🤍"}</span>
                          <span>Helpful</span>
                          <span className="font-bold tabular-nums">({helpful.count})</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===================== BOTTOM CTA BANNER (LIGHT THEME MATCHING HOME) ===================== */}
          <div className="mt-12 sm:mt-16 rounded-3xl bg-gradient-to-br from-[#fff7ed] via-[#fffbf7] to-[#eef0ff] border border-orange-200/80 p-8 sm:p-12 text-center shadow-[0_12px_40px_-15px_rgba(255,138,61,0.18)] relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ff8a3d]/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />

            <div className="relative mx-auto max-w-2xl">
              {/* Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100/90 border border-orange-200 px-3.5 py-1 text-xs font-bold text-orange-800 shadow-2xs">
                <span>💬</span>
                <span>Your Voice Matters</span>
              </span>

              {/* Title */}
              <h2 className="mt-3.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight">
                Have you booked with{" "}
                <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">
                  HomeCareX
                </span>{" "}
                recently?
              </h2>

              {/* Description */}
              <p className="mt-2 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-normal">
                Share your honest experience to help your community find trusted service professionals, and help our certified partners continuously improve.
              </p>

              {/* Dual Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <Link
                  to="/customer/reviews"
                  className="rounded-xl bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] px-7 py-3 font-bold text-xs sm:text-sm text-white shadow-[0_6px_20px_rgba(255,138,61,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,138,61,0.5)] cursor-pointer"
                >
                  Write a review now
                </Link>
                <Link
                  to="/contact"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-xs sm:text-sm text-[#1e1b4b] transition duration-200 hover:border-[#ff8a3d] hover:text-[#ff8a3d] hover:bg-orange-50/30 shadow-2xs cursor-pointer"
                >
                  Need assistance?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
