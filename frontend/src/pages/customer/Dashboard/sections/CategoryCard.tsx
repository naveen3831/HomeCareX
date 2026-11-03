import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { tintAt } from "@/components/customer";
import type { DashboardCategoryDto } from "@/features/customer";
import { resolveCategoryPhoto, CATEGORY_FALLBACK_PHOTOS } from "./dashboardImages";

/**
 * Category tile. Shows the category photo with the name over a dark fade; if there is no photo
 * (or it fails to load) it falls back to the tinted tile with a floating 3D icon.
 * `index` picks the tint and offsets the float.
 */
export default function CategoryCard({ category: c, index = 0 }: { category: DashboardCategoryDto; index?: number }) {
  const photo = resolveCategoryPhoto(c, index);

  // Real photo URL: exclude emoji or icon paths
  const cleanCategoryImg =
    c.imageUrl && !c.imageUrl.includes("/icons/3d/") && !c.imageUrl.includes("/icons/")
      ? c.imageUrl
      : null;

  const initialSrc = cleanCategoryImg || photo.src;
  const [src, setSrc] = useState(initialSrc);
  const displayName = c.name;
  const count = `${c.serviceCount} ${c.serviceCount === 1 ? "service" : "services"}`;
  const targetUrl = `${customerPath("/services")}?category=${encodeURIComponent(c.slug)}`;

  useEffect(() => {
    const validSrc =
      (c.imageUrl && !c.imageUrl.includes("/icons/3d/") && !c.imageUrl.includes("/icons/")
        ? c.imageUrl
        : null) || photo.src;
    setSrc(validSrc);
  }, [c.imageUrl, c.slug, photo.src]);

  const handleImgError = () => {
    const fallback = CATEGORY_FALLBACK_PHOTOS[index % CATEGORY_FALLBACK_PHOTOS.length].src;
    if (src !== fallback) {
      setSrc(fallback);
    }
  };

  return (
    <Link
      to={targetUrl}
      className={clsx(
        "dashboard-category group relative block h-[184px] overflow-hidden rounded-[20px] border border-white shadow-[0_7px_22px_rgba(30,27,46,.08)] md:h-[232px]",
        tintAt(index),
        FOCUS_RING,
      )}
    >
      <img
        src={src}
        alt={displayName}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={handleImgError}
        style={{ objectPosition: photo.position }}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[rgba(20,18,36,.85)] via-[rgba(20,18,36,.45)] via-[36%] to-transparent to-[64%]" />

      <span
        aria-hidden="true"
        className="absolute right-3 top-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-brand shadow-sm transition-colors duration-300 group-hover:bg-brand group-hover:text-white"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </span>

      <span className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-tight text-white md:text-sm">{displayName}</span>
        <span className="text-xs text-white/90">{count}</span>
      </span>
    </Link>
  );
}
