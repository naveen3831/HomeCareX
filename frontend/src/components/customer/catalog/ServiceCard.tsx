import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Star } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { Icon3D, formatPrice, serviceVisual } from "@/pages/customer/Shared/visuals";
import type { CatalogService } from "@/types/catalog";
import { FOCUS_RING } from "../focusRing";
import { formatDuration } from "./format";

const badgeFor = (s: CatalogService): string | null => {
  if (s.rating >= 4.8 && s.ratingCount >= 500) return "Top rated";
  if (s.ratingCount >= 1000) return "Popular";
  return null;
};

const AVAILABILITY_LABEL: Record<CatalogService["availability"], string | null> = {
  today: "Available today",
  tomorrow: "By tomorrow",
  scheduled: null,
};

export function ServiceCard({ service: s, index }: { service: CatalogService; index: number }) {
  const v = serviceVisual(s.slug, s.category.slug, s.image);
  const badge = badgeFor(s);
  const when = AVAILABILITY_LABEL[s.availability];

  return (
    <Link
      to={customerPath(`/services/${s.slug}`)}
      style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}
      className={clsx(
        "service-card-enter group flex h-full flex-col overflow-hidden rounded-[18px] sm:rounded-[20px] border border-line/80 bg-panel p-2 transition-all duration-300",
        "hover:-translate-y-1 hover:border-brand/25 hover:shadow-[0_20px_35px_-22px_rgba(67,56,202,.5)] motion-safe:active:scale-[.99]",
        FOCUS_RING,
      )}
    >
      {/* 1. Service Image - Sleek 16:10 Ratio & Uniform Height */}
      <div
        className={clsx(
          "relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-[14px] sm:rounded-[15px]",
          !v.image && clsx("flex items-center justify-center", v.tint),
        )}
      >
        {v.image ? (
          <img
            src={v.image}
            alt=""
            loading={index < 6 ? "eager" : "lazy"}
            fetchPriority={index < 3 ? "high" : "auto"}
            decoding="async"
            style={{ objectPosition: v.focus }}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : null}
        <div
          className={clsx(
            "pointer-events-none absolute inset-0",
            v.image ? "bg-gradient-to-t from-black/20 via-transparent to-white/10" : "bg-white/0",
          )}
          aria-hidden="true"
        />
        {badge && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full border border-white/80 bg-white/90 px-2 py-0.5 text-[9.5px] font-bold text-[#B45309] shadow-xs backdrop-blur">
            {badge}
          </span>
        )}
        {!v.image && (
          <Icon3D
            asset={v.asset}
            emoji={s.icon}
            delayMs={index * 500}
            className="relative z-[1] h-20 w-20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[-4deg]"
          />
        )}
        {when && (
          <span className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-[#166534]/90 px-2 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" aria-hidden="true" />
            {when}
          </span>
        )}
        <span className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand shadow-xs backdrop-blur transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      {/* 2. Content Section - Refined Compact Spacing */}
      <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 pt-2">
        {/* Title: 2-line height ensures uniform alignment */}
        <h2 className="line-clamp-2 min-h-[2.25rem] text-[13.5px] sm:text-[14px] font-bold leading-snug text-ink">
          {s.name}
        </h2>

        {/* Category Description */}
        <p className="mt-0.5 truncate text-[11px] text-muted">{s.category.name}</p>

        {/* Rating and Duration */}
        <div className="mt-2 flex items-center gap-2.5 text-[11.5px] text-ink/70">
          <span className="inline-flex items-center gap-1 font-semibold text-ink">
            <Star className="h-3 w-3 fill-accent text-accent" aria-hidden="true" />
            {s.ratingCount > 0 ? s.rating.toFixed(1) : "New"}
            {s.ratingCount > 0 && (
              <span className="font-normal text-muted">({s.ratingCount.toLocaleString("en-IN")})</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-muted">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            {formatDuration(s.durationMinutes)}
          </span>
        </div>

        {/* 3. Bottom Section - Starting At Price & Book Now button */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted">Starting at</p>
            <p className="text-base sm:text-[17px] font-bold tracking-tight text-ink">
              {formatPrice(s.basePrice)}
            </p>
          </div>
          <span className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all duration-200 group-hover:bg-[#3730A3] group-hover:shadow-sm">
            Book now
          </span>
        </div>
      </div>
    </Link>
  );
}
