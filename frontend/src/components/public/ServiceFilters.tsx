import React, { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  X,
  Sparkles,
  Tv,
  Flower2,
  Wrench,
  Paintbrush,
  Bug,
  LayoutGrid,
} from "lucide-react";

export type SortOption =
  | "popular"
  | "price-low"
  | "price-high";

export interface CategoryOption {
  label: string;
  value: string;
}

interface ServiceFiltersProps {
  q: string;
  /** Real categories, already in the admin's order. Empty or missing: the built-in list below is used. */
  categories?: CategoryOption[];
  category: string;
  sort: SortOption;
  pincode: string;

  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onPincodeChange: (value: string) => void;
  onClear: () => void;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { label: "Home Cleaning", value: "home-cleaning" },
  {
    label: "Appliance Repair & Service",
    value: "appliance-repair-service",
  },
  { label: "Salon & Spa", value: "salon-spa" },
  {
    label: "Electrical & Plumbing",
    value: "electrical-plumbing",
  },
  {
    label: "Painting & Waterproofing",
    value: "painting-waterproofing",
  },
  { label: "Pest Control", value: "pest-control" },
  {
    label: "Carpentry & Furniture Assembly",
    value: "carpentry-furniture-assembly",
  },
];

const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500";

const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-9 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs outline-none transition hover:border-indigo-200 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15";

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-indigo-200 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15";

const buttonFocusClass =
  "focus:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-2";

const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};

const getCategoryIcon = (slug: string) => {
  const s = slug.toLowerCase();
  if (s.includes("clean")) return Sparkles;
  if (s.includes("appliance")) return Tv;
  if (s.includes("salon") || s.includes("spa")) return Flower2;
  if (s.includes("plumb") || s.includes("electr") || s.includes("carpent")) return Wrench;
  if (s.includes("paint")) return Paintbrush;
  if (s.includes("pest")) return Bug;
  return LayoutGrid;
};

const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  q,
  categories,
  category,
  sort,
  pincode,
  onQueryChange,
  onCategoryChange,
  onSortChange,
  onPincodeChange,
  onClear,
}) => {
  const [open, setOpen] = useState(false);

  const categoryList =
    categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const getCategoryLabel = (value: string) =>
    categoryList.find((item) => item.value === value)?.label ?? value;

  const normalizedCategory =
    categoryList.find(
      (item) =>
        item.value === category ||
        item.label.toLowerCase() === category.toLowerCase(),
    )?.value ?? "";

  const hasFilters =
    q.trim() !== "" ||
    category !== "" ||
    sort !== "popular" ||
    pincode !== "";

  const panelFilterCount =
    (category !== "" ? 1 : 0) +
    (sort !== "popular" ? 1 : 0) +
    (pincode !== "" ? 1 : 0);

  return (
    <section className="mb-8">
      {/* Search & Filter Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-[0_4px_24px_-4px_rgba(79,70,229,0.06)] backdrop-blur-sm">
        {/* Search Row */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <label htmlFor="service-search" className="sr-only">
              Search services
            </label>

            <input
              id="service-search"
              type="text"
              value={q}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search for cleaning, plumbing, electrical..."
              className="h-11 sm:h-12 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-10 text-xs sm:text-sm font-medium text-slate-800 shadow-2xs outline-none transition placeholder:text-slate-400 hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15"
            />

            {q && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className={`absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition hover:bg-slate-300 ${buttonFocusClass}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Toggle Filter Panel Button */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="service-filter-panel"
            className={`relative flex h-11 sm:h-12 shrink-0 items-center gap-2 rounded-xl border px-3.5 sm:px-4 text-xs sm:text-sm font-bold shadow-2xs transition-all duration-200 ${buttonFocusClass} ${
              open
                ? "border-indigo-600 bg-gradient-to-r from-[#4338ca] to-[#3730a3] text-white shadow-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600"
            }`}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>

            {panelFilterCount > 0 && (
              <span
                className={`flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${
                  open
                    ? "bg-white text-indigo-700"
                    : "bg-[#f97316] text-white"
                }`}
              >
                {panelFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Category Pills Scrollbar */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {/* All Categories Chip */}
          <button
            type="button"
            onClick={() => onCategoryChange("")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              !normalizedCategory
                ? "bg-gradient-to-r from-[#4338ca] to-[#3730a3] text-white shadow-xs"
                : "bg-slate-100/80 text-slate-600 border border-slate-200/60 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
            }`}
          >
            <LayoutGrid size={12} />
            <span>All Services</span>
          </button>

          {/* Individual Category Chips */}
          {categoryList.slice(0, 6).map((item) => {
            const isSelected = normalizedCategory === item.value;
            const Icon = getCategoryIcon(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onCategoryChange(isSelected ? "" : item.value)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isSelected
                    ? "bg-gradient-to-r from-[#4338ca] to-[#3730a3] text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 border border-slate-200/60 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                }`}
              >
                <Icon size={12} className={isSelected ? "text-white" : "text-indigo-500"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expandable Filter Panel */}
        {open && (
          <div
            id="service-filter-panel"
            className="mt-4 grid gap-3.5 rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/40 p-4 sm:grid-cols-3"
          >
            <div>
              <label htmlFor="service-category" className={labelClass}>
                Category
              </label>

              <select
                id="service-category"
                value={normalizedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className={selectClass}
                style={chevronStyle}
              >
                <option value="">All Categories</option>

                {categoryList.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="service-sort" className={labelClass}>
                Sort By
              </label>

              <select
                id="service-sort"
                value={sort}
                onChange={(e) =>
                  onSortChange(e.target.value as SortOption)
                }
                className={selectClass}
                style={chevronStyle}
              >
                <option value="popular">Featured / Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            <div>
              <label htmlFor="service-pincode" className={labelClass}>
                Your Location
              </label>

              <div className="relative">
                <MapPin
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500"
                />

                <input
                  id="service-pincode"
                  type="text"
                  inputMode="numeric"
                  value={pincode}
                  onChange={(e) =>
                    onPincodeChange(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="Enter 6-digit pincode"
                  maxLength={6}
                  className={`${inputClass} pl-9 pr-3`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filters & Clear Row */}
        {hasFilters && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active:
              </span>

              {q && (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <span className="truncate max-w-[12rem]">"{q}"</span>
                  <X size={11} aria-hidden="true" />
                </button>
              )}

              {category && (
                <button
                  type="button"
                  onClick={() => onCategoryChange("")}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100"
                >
                  <span>{getCategoryLabel(normalizedCategory)}</span>
                  <X size={11} aria-hidden="true" />
                </button>
              )}

              {sort !== "popular" && (
                <button
                  type="button"
                  onClick={() => onSortChange("popular")}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <span>
                    {sort === "price-low"
                      ? "Price: Low to High"
                      : "Price: High to Low"}
                  </span>
                  <X size={11} aria-hidden="true" />
                </button>
              )}

              {pincode && (
                <button
                  type="button"
                  onClick={() => onPincodeChange("")}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100"
                >
                  <MapPin size={10} aria-hidden="true" />
                  <span>{pincode}</span>
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Clear All Filters button */}
            <button
              type="button"
              onClick={onClear}
              className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 ${buttonFocusClass}`}
            >
              <X size={12} aria-hidden="true" />
              <span>Clear filters</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServiceFilters;
