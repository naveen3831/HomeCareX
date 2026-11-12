import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";

// ============================================================================
// Crafted Vector Icons Matching Target Design Exactly
// ============================================================================

function AllServicesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="8" height="8" rx="2.5" />
      <rect x="13.5" y="2.5" width="8" height="8" rx="2.5" />
      <rect x="2.5" y="13.5" width="8" height="8" rx="2.5" />
      <rect x="13.5" y="13.5" width="8" height="8" rx="2.5" />
    </svg>
  );
}

function HomeCleaningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 4h-4v2.5h4V4z" />
      <path d="M10 6.5v2l-2.5 2.5v9a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-9l-2.5-2.5v-2" />
      <path d="M14 9h3.5l1.2 2.5" />
      <circle cx="20" cy="5.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="22" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="10" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SalonSpaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.5c-1.8 3.5-1.8 7 0 10.5 1.8-3.5 1.8-7 0-10.5z" />
      <path d="M11 13.5C7.5 12 4.5 12.5 3 15c2.5 3 6.5 2.5 8-1.5z" />
      <path d="M13 13.5c3.5-1.5 6.5-1 8 1.5-2.5 3-6.5 2.5-8-1.5z" />
      <path d="M9 19c1.5.8 4.5.8 6 0" />
    </svg>
  );
}

function ApplianceRepairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="3" width="17" height="18" rx="3" />
      <path d="M3.5 8h17" />
      <circle cx="7" cy="5.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="5.5" r="0.75" fill="currentColor" stroke="none" />
      <line x1="15" y1="5.5" x2="17.5" y2="5.5" />
      <circle cx="12" cy="14" r="4.5" />
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}

function ElectricalPlumbingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 2.5L4.5 13.5H12L11 21.5L19.5 10.5H12L13 2.5Z" />
    </svg>
  );
}

function PaintingWaterproofingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="5.5" rx="1.5" />
      <path d="M20 6.5v3.5a2 2 0 0 1-2 2h-6v2" />
      <rect x="10.5" y="14" width="3" height="7" rx="1" />
    </svg>
  );
}

function PestControlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9a3 3 0 0 0-3-3h6a3 3 0 0 0-3 3" />
      <path d="M9 3L7.5 5" />
      <path d="M15 3l1.5 2" />
      <ellipse cx="12" cy="14.5" rx="5" ry="5.5" />
      <path d="M12 9v11" />
      <path d="M5.5 11.5l2 1" />
      <path d="M18.5 11.5l-2 1" />
      <path d="M5 15.5h2.5" />
      <path d="M16.5 15.5H19" />
      <path d="M5.5 19.5l2-1" />
      <path d="M18.5 19.5l-2-1" />
    </svg>
  );
}

function CarpentryFurnitureIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9H6V5z" />
      <rect x="3.5" y="10.5" width="3" height="5" rx="1" />
      <rect x="17.5" y="10.5" width="3" height="5" rx="1" />
      <path d="M6.5 12h11v3.5h-11V12z" />
      <path d="M5.5 16.5V21" />
      <path d="M18.5 16.5V21" />
    </svg>
  );
}

function AcServiceRepairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="8.5" rx="2" />
      <line x1="5.5" y1="9.5" x2="14" y2="9.5" />
      <circle cx="17.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
      <path d="M6.5 15.5c1 1 2 1.2 3 0" />
      <path d="M10.5 15.5c1 1 2 1.2 3 0" />
      <path d="M14.5 15.5c1 1 2 1.2 3 0" />
      <path d="M8.5 18.5c1 1 2 1.2 3 0" />
      <path d="M12.5 18.5c1 1 2 1.2 3 0" />
    </svg>
  );
}

export interface ServiceCategory {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "all",
    label: "All Services",
    icon: AllServicesIcon,
    iconColor: "text-indigo-600",
  },
  {
    id: "cleaning",
    label: "Home Cleaning",
    icon: HomeCleaningIcon,
    iconColor: "text-sky-500",
  },
  {
    id: "salon",
    label: "Salon & Spa",
    icon: SalonSpaIcon,
    iconColor: "text-pink-500",
  },
  {
    id: "appliance",
    label: "Appliance Repair",
    icon: ApplianceRepairIcon,
    iconColor: "text-blue-600",
  },
  {
    id: "electrical-plumbing",
    label: "Electrical & Plumbing",
    icon: ElectricalPlumbingIcon,
    iconColor: "text-amber-500",
  },
  {
    id: "painting",
    label: "Painting & Waterproofing",
    icon: PaintingWaterproofingIcon,
    iconColor: "text-rose-500",
  },
  {
    id: "pest-control",
    label: "Pest Control",
    icon: PestControlIcon,
    iconColor: "text-emerald-500",
  },
  {
    id: "carpentry",
    label: "Carpentry & Furniture",
    icon: CarpentryFurnitureIcon,
    iconColor: "text-amber-800",
  },
  {
    id: "ac-repair",
    label: "AC Service & Repair",
    icon: AcServiceRepairIcon,
    iconColor: "text-cyan-600",
  },
];

export interface ServiceCategoriesStripProps {
  selectedCategory?: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
}

/**
 * Normalizes any category string or URL param into a standard ServiceCategory id.
 */
export function mapParamToCategoryId(categoryParam?: string): string {
  if (!categoryParam || categoryParam === "all") return "all";
  const p = categoryParam.toLowerCase();
  if (p === "ac-repair" || p === "ac") return "ac-repair";
  if (p.includes("clean")) return "cleaning";
  if (p.includes("salon") || p.includes("spa")) return "salon";
  if (p.includes("appliance")) return "appliance";
  if (p.includes("plumb") || p.includes("electr")) return "electrical-plumbing";
  if (p.includes("paint") || p.includes("waterproof")) return "painting";
  if (p.includes("pest")) return "pest-control";
  if (p.includes("carpent") || p.includes("furniture")) return "carpentry";
  return categoryParam;
}

export function ServiceCategoriesStrip({
  selectedCategory = "all",
  onSelectCategory,
  className,
}: ServiceCategoriesStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();

    // Recheck after initial render & layout
    const timer = setTimeout(checkScroll, 100);

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 320;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const normalizedSelected = mapParamToCategoryId(selectedCategory);

  return (
    <section className={clsx("w-full select-none", className)} aria-label="Categories">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900">Categories</h2>
        <Link
          to={customerPath("/categories")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View All &rarr;
        </Link>
      </div>

      {/* Horizontal Scroll Strip Container */}
      <div className="relative group">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label="Scroll left"
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scroll Container */}
        <div
          ref={scrollContainerRef}
          role="tablist"
          aria-label="Categories filter"
          className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto scroll-smooth no-scrollbar py-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = normalizedSelected === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectCategory(cat.id)}
                className={clsx(
                  "min-w-[110px] sm:min-w-[116px] max-w-[124px] shrink-0 flex flex-col items-center justify-center text-center rounded-2xl px-3 py-3.5 transition-all duration-150 select-none cursor-pointer focus:outline-none",
                  isActive
                    ? "bg-[#EEF2FF] border border-[#E0E7FF] text-[#4F46E5] shadow-xs font-semibold"
                    : "bg-white border border-slate-100 text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:border-indigo-200 hover:bg-indigo-50/20 hover:-translate-y-0.5",
                )}
              >
                <div
                  className={clsx(
                    "mb-2 flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                    isActive ? "text-indigo-600" : cat.iconColor,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span
                  className={clsx(
                    "text-[11.5px] sm:text-xs leading-tight line-clamp-2",
                    isActive ? "font-semibold text-indigo-700" : "font-medium text-slate-800",
                  )}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label="Scroll right"
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
