import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Hammer, PaintRoller, Sparkles, Wrench, Zap, Bug } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { categoryVisual } from "@/pages/customer/Shared/visuals";
import type { CatalogCategory } from "@/types/catalog";
import { FOCUS_RING } from "../focusRing";

export function LotusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 4c-1.5 3-2 5.5-2 8.5 0 2 1 3.5 2 3.5s2-1.5 2-3.5c0-3-.5-5.5-2-8.5Z" />
      <path d="M9.5 14.5C7 14 4.5 12 3.5 10c2.5 0 5 1.5 6.5 3.5" />
      <path d="M14.5 14.5C17 14 19.5 12 20.5 10c-2.5 0-5 1.5-6.5 3.5" />
      <path d="M7 17c3 1.5 7 1.5 10 0" />
    </svg>
  );
}

export function BroomIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m14 4 6 6" />
      <path d="m15.5 5.5-6.5 6.5" />
      <path d="m7.5 13.5 3 3" />
      <path d="M7.5 13.5 5 16c-1 1-1.5 2.5-1.5 4 1.5 0 3-.5 4-1.5l2.5-2.5" />
      <path d="m6 18.5 2.5 2.5" />
    </svg>
  );
}

interface Props {
  category: CatalogCategory;
  /** Index in the grid for lazy loading optimization. */
  index: number;
  featured?: boolean;
}

function getCategoryTheme(slug: string, name: string) {
  const s = slug.toLowerCase();
  const n = name.toLowerCase();

  if (s.includes("appliance") || n.includes("appliance")) {
    return {
      type: "appliance",
      defaultImage: "/images/appliance-repair.jpg",
      focus: "50% 22%",
      badgeBg: "bg-[#EFF6FF]",
      badgeBorder: "border-[#DBEAFE]",
      iconColor: "text-[#2563EB]",
    };
  }
  if (s.includes("salon") || s.includes("spa") || n.includes("salon") || n.includes("spa")) {
    return {
      type: "salon",
      defaultImage: "/images/Home-spa-women-banner.jpg",
      focus: "50% 36%",
      badgeBg: "bg-[#FAF5FF]",
      badgeBorder: "border-[#F3E8FF]",
      iconColor: "text-[#9333EA]",
    };
  }
  if (s.includes("clean") || n.includes("clean")) {
    return {
      type: "cleaning",
      defaultImage: "/images/home-cleaning.jpg",
      focus: "50% 50%",
      badgeBg: "bg-[#ECFDF5]",
      badgeBorder: "border-[#D1FAE5]",
      iconColor: "text-[#059669]",
    };
  }
  if (s.includes("electrical") || s.includes("plumb") || n.includes("electrical") || n.includes("plumb")) {
    return {
      type: "electrical",
      defaultImage: "/images/electrical.jpg",
      focus: "35% 50%",
      badgeBg: "bg-[#FFFBEB]",
      badgeBorder: "border-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    };
  }
  if (s.includes("paint") || n.includes("paint") || s.includes("waterproof")) {
    return {
      type: "painting",
      defaultImage: "/images/painting-category.png",
      focus: "50% 50%",
      badgeBg: "bg-[#FFF1F2]",
      badgeBorder: "border-[#FFE4E6]",
      iconColor: "text-[#E11D48]",
    };
  }
  if (s.includes("pest") || n.includes("pest")) {
    return {
      type: "pest",
      defaultImage: "/images/pest-control-clean.png",
      focus: "60% 50%",
      badgeBg: "bg-[#F0FDFA]",
      badgeBorder: "border-[#CCFBF1]",
      iconColor: "text-[#0D9488]",
    };
  }
  if (s.includes("carpent") || n.includes("carpent") || s.includes("furniture")) {
    return {
      type: "carpentry",
      defaultImage: "/images/furniture-assembly.jpg",
      focus: "50% 45%",
      badgeBg: "bg-[#FFF7ED]",
      badgeBorder: "border-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    };
  }
  return {
    type: "default",
    defaultImage: "/images/home-maintenance.jpg",
    focus: "50% 50%",
    badgeBg: "bg-[#EEECFB]",
    badgeBorder: "border-[#E0E7FF]",
    iconColor: "text-[#4338CA]",
  };
}

function BadgeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "appliance":
      return <Wrench className={className} strokeWidth={2.2} />;
    case "salon":
      return <LotusIcon className={className} />;
    case "cleaning":
      return <BroomIcon className={className} />;
    case "electrical":
      return <Zap className={className} strokeWidth={2.2} />;
    case "painting":
      return <PaintRoller className={className} strokeWidth={2.2} />;
    case "pest":
      return <Bug className={className} strokeWidth={2.2} />;
    case "carpentry":
      return <Hammer className={className} strokeWidth={2.2} />;
    default:
      return <Sparkles className={className} strokeWidth={2.2} />;
  }
}

/**
 * Redesigned category card matching modern clean iOS/Android mobile card design:
 * - Rounded rectangle card with soft shadow
 * - Top: High-quality service photo with rounded top corners
 * - Floating themed icon badge at bottom-left of the image
 * - Bottom: Crisp white bar with category title and chevron right icon
 */
export function CategoryCard({ category: c, index }: Props) {
  const v = categoryVisual(c.slug);
  const theme = getCategoryTheme(c.slug, c.name);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);

  // Choose the best matching image candidate
  const photo =
    [
      c.imageUrl?.trim(),
      theme.defaultImage,
      v.image,
      "/images/home-maintenance.jpg",
    ].find((src): src is string => !!src && !failedPhotos.includes(src)) ?? null;

  return (
    <Link
      to={`${customerPath("/services")}?category=${encodeURIComponent(c.slug)}`}
      aria-label={c.name}
      className={clsx(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[16px] sm:rounded-[18px] bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-200/90 transition-all duration-200",
        FOCUS_RING,
      )}
    >
      {/* Top Image Section */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {photo && (
          <img
            src={photo}
            alt={c.name}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            onError={() =>
              setFailedPhotos((list) => (list.includes(photo) ? list : [...list, photo]))
            }
            style={{ objectPosition: theme.focus || v.focus || "center" }}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        )}

        {/* Floating Category Icon Badge at bottom-left */}
        <div
          aria-hidden="true"
          className={clsx(
            "absolute left-2.5 bottom-2.5 sm:left-3 sm:bottom-3 z-10 flex h-8 w-8 sm:h-8.5 sm:w-8.5 md:h-9 md:w-9 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105",
            theme.badgeBg,
            theme.badgeBorder,
            theme.iconColor,
          )}
        >
          <BadgeIcon type={theme.type} className="h-4 w-4 sm:h-[17px] sm:w-[17px] md:h-[18px] md:w-[18px]" />
        </div>
      </div>

      {/* Bottom Content Bar: Title + Right Chevron */}
      <div className="flex flex-1 items-center justify-between gap-1.5 bg-white p-2.5 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3 min-h-[46px] sm:min-h-[48px] md:min-h-[50px]">
        <h2 className="text-[13px] sm:text-[13.5px] md:text-[14px] font-semibold text-slate-800 leading-snug line-clamp-2">
          {c.name}
        </h2>
        <ChevronRight
          className="h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
