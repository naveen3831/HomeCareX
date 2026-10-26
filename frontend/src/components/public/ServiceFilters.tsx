import React, { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  X,
} from "lucide-react";

export type SortOption =
  | "popular"
  | "price-low"
  | "price-high";

interface ServiceFiltersProps {
  q: string;
  category: string;
  sort: SortOption;
  pincode: string;

  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onPincodeChange: (value: string) => void;
  onClear: () => void;
}


const CATEGORIES = [
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
  "mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#6b6b8a]";

const selectClass =
  "h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#e0e7ff] bg-white pl-4 pr-10 text-sm font-semibold text-[#11104f] shadow-sm outline-none transition hover:border-[#c7d2fe] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e0e7ff] bg-white text-sm font-semibold text-[#11104f] shadow-sm outline-none transition placeholder:font-normal placeholder:text-[#9999b0] hover:border-[#c7d2fe] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10";

const buttonFocusClass =
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4f46e5]/25 focus-visible:ring-offset-2";

const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8ba7' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
};

const indigoChip =
  "flex items-center gap-1.5 rounded-full border border-[#e0e7ff] bg-[#eef2ff] px-3 py-1.5 text-xs font-semibold text-[#4338ca] transition hover:bg-[#e0e7ff]";

const orangeChip =
  "flex items-center gap-1.5 rounded-full border border-[#ffe4d3] bg-[#fff5ef] px-3 py-1.5 text-xs font-semibold text-[#e0600f] transition hover:bg-[#ffe9db]";

const getCategoryLabel = (value: string) =>
  CATEGORIES.find((item) => item.value === value)?.label ??
  value;

const ServiceFilters: React.FC<ServiceFiltersProps> = ({
  q,
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

  // Supports old URLs such as ?category=Painting.

const normalizedCategory =
  CATEGORIES.find(
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
      <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold leading-tight text-[#11104f]">
            Find a Service
          </h2>
          <p className="text-xs text-[#6b6b8a]">
            Search and filter services based on your needs
          </p>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className={`flex w-fit items-center gap-1.5 rounded-xl border border-[#e0e7ff] bg-white px-3.5 py-2 text-sm font-semibold text-[#4338ca] shadow-sm transition hover:bg-[#eef2ff] ${buttonFocusClass}`}
          >
            <X size={15} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_30px_rgba(17,16,79,0.06)] sm:p-6">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              size={20}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8b8ba7]"
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
              className={`${inputClass} h-14 rounded-2xl bg-[#f8f9ff] pl-12 pr-12 font-medium`}
            />

            {q && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#e5e7eb] text-[#55556f] ${buttonFocusClass}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* CHANGED: added aria-label so the button has a name on phones, where the "Filters" text is hidden */}
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            aria-expanded={open}
            aria-controls="service-filter-panel"
            aria-label={panelFilterCount > 0 ? `Filters (${panelFilterCount} active)` : "Filters"}
            className={`relative flex h-14 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-bold shadow-sm transition ${buttonFocusClass} sm:px-5 ${
              open
                ? "border-[#4338ca] bg-[#4338ca] text-white"
                : "border-[#e0e7ff] bg-white text-[#4338ca] hover:border-[#c7d2fe] hover:bg-[#eef2ff]"
            }`}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>

            {panelFilterCount > 0 && (
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                  open
                    ? "bg-white text-[#4338ca]"
                    : "bg-[#ff8a3d] text-white"
                }`}
              >
                {panelFilterCount}
              </span>
            )}
          </button>
        </div>

        {open && (
          <div
            id="service-filter-panel"
            className="mt-5 grid gap-4 rounded-2xl border border-[#e0e7ff] bg-[#f8f9ff] p-4 sm:p-5 md:grid-cols-3"
          >
            <div>
              <label
                htmlFor="service-category"
                className={labelClass}
              >
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

                {CATEGORIES.map((item) => (
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
                <option value="popular">Popular</option>
                <option value="price-low">
                  Price: Low to High
                </option>
                <option value="price-high">
                  Price: High to Low
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="service-pincode"
                className={labelClass}
              >
                Your Location
              </label>

              <div className="relative">
                <MapPin
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4f46e5]"
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
                  className={`${inputClass} pl-11 pr-4`}
                />
              </div>
            </div>
          </div>
        )}

        {hasFilters && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#f0f0f7] pt-5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[#8b8ba7]">
              Active:
            </span>

            {q && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className={`${indigoChip} max-w-[16rem]`}
              >
                <span className="truncate">Search: {q}</span>
                <X size={12} aria-hidden="true" />
              </button>
            )}

            {category && (
              <button
                type="button"
                onClick={() => onCategoryChange("")}
                className={orangeChip}
              >
                {getCategoryLabel(normalizedCategory)}
                <X size={12} aria-hidden="true" />
              </button>
            )}

            {sort !== "popular" && (
              <button
                type="button"
                onClick={() => onSortChange("popular")}
                className={indigoChip}
              >
                {sort === "price-low"
                  ? "Price: Low to High"
                  : "Price: High to Low"}
                <X size={12} aria-hidden="true" />
              </button>
            )}

            {pincode && (
              <button
                type="button"
                onClick={() => onPincodeChange("")}
                className={orangeChip}
              >
                <MapPin size={12} aria-hidden="true" />
                {pincode}
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ServiceFilters;