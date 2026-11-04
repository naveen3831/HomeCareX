import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import CategoryIcon from "@/components/customer/CategoryIcon";
import { tintAt } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import type { DashboardCategoryDto } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import { resolveCategoryPhoto } from "./dashboardImages";

/**
 * Category tile. Shows the category photo with the name over a dark fade; if it fails to load,
 * it falls back to the tinted tile with the category icon.
 */
export default function CategoryCard({ category: c, index = 0 }: { category: DashboardCategoryDto; index?: number }) {
  const photo = resolveCategoryPhoto(c, index);
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const showPhoto = photo.src !== failedPhoto;
  const count = `${c.serviceCount} ${c.serviceCount === 1 ? "service" : "services"}`;
  const targetUrl = `${customerPath("/services")}?category=${encodeURIComponent(c.slug)}`;

  return (
    <Link
      to={targetUrl}
      className={clsx(
        "dashboard-category group relative block h-[184px] overflow-hidden rounded-[20px] border border-white shadow-[0_7px_22px_rgba(30,27,46,.08)] md:h-[232px]",
        tintAt(index),
        FOCUS_RING,
      )}
    >
      {showPhoto ? (
        <img
          src={photo.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedPhoto(photo.src)}
          style={{ objectPosition: photo.position }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <CategoryIcon
          iconUrl={c.iconUrl}
          hints={[c.icon, c.name, c.slug]}
          size={76}
          delay={index * -0.7}
          className="absolute -bottom-1 right-1 md:right-2 md:h-[88px] md:w-[88px]"
        />
      )}
      {showPhoto && (
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[rgba(20,18,36,.85)] via-[rgba(20,18,36,.45)] via-[36%] to-transparent to-[64%]" />
      )}

      <span
        aria-hidden="true"
        className="absolute right-3 top-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-brand shadow-sm transition-colors duration-300 group-hover:bg-brand group-hover:text-white"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </span>

      <span className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-0.5">
        <span className={clsx("text-[13px] font-semibold leading-tight md:text-sm", showPhoto ? "text-white" : "text-ink")}>{c.name}</span>
        <span className={clsx("text-xs", showPhoto ? "text-white/90" : "text-muted")}>{count}</span>
      </span>
    </Link>
  );
}
