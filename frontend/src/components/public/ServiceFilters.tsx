import React, { useState } from "react";
import {
  Search,
  Filter,
  MapPin,
  X,
  Sparkles,
  Wrench,
  Scissors,
  Zap,
  PaintRoller,
  Bug,
  LayoutGrid,
  Layers,
  Star,
  RotateCcw,
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
  initialOpen?: boolean;

  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onPincodeChange: (value: string) => void;
  onClear: () => void;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { label: "Appliance Repair", value: "appliance-repair" },
  { label: "Salon & Spa", value: "salon-spa" },
  { label: "Home Cleaning", value: "home-cleaning" },
  { label: "Electrical & Plumbing", value: "electrical-plumbing" },
  { label: "Painting & Waterproofing", value: "painting-waterproofing" },
  { label: "Pest Control", value: "pest-control" },
  { label: "Carpentry & Furniture Assembly", value: "carpentry-furniture-assembly" },
];

const buttonFocusClass =
  "focus:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2";

const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
};

const getCategoryIcon = (slugOrLabel: string) => {
  const s = slugOrLabel.toLowerCase();
  if (s.includes("clean")) return Sparkles;
  if (s.includes("appliance")) return Wrench;
  if (s.includes("salon") || s.includes("spa")) return Scissors;
  if (s.includes("electr") || s.includes("plumb")) return Zap;
  if (s.includes("paint") || s.includes("waterproof")) return PaintRoller;
  if (s.includes("pest")) return Bug;
  if (s.includes("carpent") || s.includes("furnitur")) return Wrench;
  return LayoutGrid;
};

const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  q,
  categories,
  category,
  sort,
  pincode,
  initialOpen = false,
  onQueryChange,
  onCategoryChange,
  onSortChange,
  onPincodeChange,
  onClear,
}) => {
  const [open, setOpen] = useState(initialOpen);

  const categoryList =
    categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const isCategoryMatch = (selectedCat: string, optionVal: string, optionLabel: string) => {
    if (!selectedCat) return false;
    const s = selectedCat.toLowerCase();
    const v = optionVal.toLowerCase();
    const l = optionLabel.toLowerCase();
    if (s === v || s === l) return true;

    const normalize = (k: string) => {
      if (k.includes("appliance")) return "appliance";
      if (k.includes("clean")) return "clean";
      if (k.includes("plumb") || k.includes("electr")) return "plumb-electr";
      if (k.includes("paint")) return "paint";
      if (k.includes("pest")) return "pest";
      if (k.includes("salon") || k.includes("spa")) return "salon-spa";
      if (k.includes("carpent")) return "carpent";
      return k.replace(/[-_]/g, " ").trim();
    };

    return normalize(s) === normalize(v) || normalize(s) === normalize(l);
  };

  const getCategoryLabel = (value: string) => {
    if (!value) return "";
    const matched = categoryList.find((item) =>
      isCategoryMatch(value, item.value, item.label)
    );
    if (matched) return matched.label;
    return value
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const activeCategoryItem = categoryList.find((item) =>
    isCategoryMatch(category, item.value, item.label)
  );

  const normalizedCategory = activeCategoryItem?.value ?? category;

  const hasFilters =
    q.trim() !== "" ||
    category !== "" ||
    sort !== "popular" ||
    pincode !== "";

  const panelFilterCount =
    (q.trim() !== "" ? 1 : 0) +
    (category !== "" ? 1 : 0) +
    (sort !== "popular" ? 1 : 0) +
    (pincode !== "" ? 1 : 0);

  return (
    <section className="mb-6 sm:mb-8">
      {/* Search & Filter Card */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-4">
        {/* Row 1: Search & Filter Button */}
        <div className="flex items-center gap-3">
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
              className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50/40 pl-10 pr-10 text-xs sm:text-sm font-medium text-slate-800 shadow-2xs outline-none transition placeholder:text-slate-400 hover:border-blue-200 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
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
            className={`flex h-11 sm:h-12 shrink-0 items-center gap-2 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-bold shadow-xs transition-all duration-200 cursor-pointer ${buttonFocusClass} ${
              open
                ? "bg-[#1d4ed8] hover:bg-[#1e40af] text-white shadow-blue-200"
                : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600"
            }`}
          >
            <Filter size={16} aria-hidden="true" className="shrink-0" />
            <span>Filters{panelFilterCount > 0 ? ` (${panelFilterCount})` : ""}</span>
          </button>
        </div>

        {/* Row 2: Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {/* All Services button */}
          <button
            type="button"
            onClick={() => onCategoryChange("")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
              !category
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100/80 text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 border border-slate-200/60"
            }`}
          >
            <LayoutGrid size={14} className={!category ? "text-white" : "text-blue-600"} />
            <span>All Services</span>
          </button>

          {/* Individual Category Chips */}
          {categoryList.map((item) => {
            const isSelected = isCategoryMatch(category, item.value, item.label);
            const Icon = getCategoryIcon(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onCategoryChange(isSelected ? "" : item.value)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 border border-slate-200/60"
                }`}
              >
                <Icon size={14} className={isSelected ? "text-white" : "text-blue-600"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Structured 3-Box Filter Inputs (Category, Sort By, Location) */}
        {open && (
          <div
            id="service-filter-panel"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 pt-1"
          >
            {/* Box 1: Category */}
            <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-all hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
              <Layers className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor="service-category" className="block text-[11px] font-medium text-slate-500 leading-tight">
                  Category
                </label>
                <select
                  id="service-category"
                  value={normalizedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-xs sm:text-sm font-semibold text-slate-800 outline-none truncate"
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
            </div>

            {/* Box 2: Sort By */}
            <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-all hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
              <Star className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor="service-sort" className="block text-[11px] font-medium text-slate-500 leading-tight">
                  Sort By
                </label>
                <select
                  id="service-sort"
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as SortOption)}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-6 text-xs sm:text-sm font-semibold text-slate-800 outline-none truncate"
                  style={chevronStyle}
                >
                  <option value="popular">Featured / Most Popular</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Box 3: Location */}
            <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-all hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <label htmlFor="service-pincode" className="block text-[11px] font-medium text-slate-500 leading-tight">
                  Your Location
                </label>
                <input
                  id="service-pincode"
                  type="text"
                  inputMode="numeric"
                  value={pincode}
                  onChange={(e) =>
                    onPincodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit pincode"
                  maxLength={6}
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Row 4: Active Filters & Clear All */}
        {hasFilters && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-700">
                Active Filters:
              </span>

              {category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span>{getCategoryLabel(category)}</span>
                  <button
                    type="button"
                    onClick={() => onCategoryChange("")}
                    className="hover:text-blue-900 focus:outline-none cursor-pointer"
                    aria-label={`Remove ${getCategoryLabel(category)} filter`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}

              {q && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="truncate max-w-[12rem]">"{q}"</span>
                  <button
                    type="button"
                    onClick={() => onQueryChange("")}
                    className="hover:text-blue-900 focus:outline-none cursor-pointer"
                    aria-label="Remove search query filter"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}

              {sort !== "popular" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span>
                    {sort === "price-low" ? "Price: Low to High" : "Price: High to Low"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSortChange("popular")}
                    className="hover:text-blue-900 focus:outline-none cursor-pointer"
                    aria-label="Reset sort"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}

              {pincode && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold text-blue-700">
                  <MapPin size={11} aria-hidden="true" />
                  <span>{pincode}</span>
                  <button
                    type="button"
                    onClick={() => onPincodeChange("")}
                    className="hover:text-blue-900 focus:outline-none cursor-pointer"
                    aria-label="Remove location filter"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>

            {/* Clear All button */}
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear filters"
              className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] cursor-pointer ${buttonFocusClass}`}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServiceFilters;
