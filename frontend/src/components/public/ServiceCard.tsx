import React, { useState, useContext } from "react";
import { ArrowRight, Star, Clock, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useAuthStore } from "@/store/useAuthStore";
import { safeAlt } from "@/lib/querySanitize";

interface ServiceCardProps {
  id: string;
  image: string;
  fallbackImage: string;
  category: string;
  name: string;
  rating: number;
  price: number;
  duration: string;
  /** Set on the first visible cards so their image loads immediately (better LCP). */
  priority?: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  id,
  image,
  fallbackImage,
  category,
  name,
  rating,
  price,
  duration,
  priority = false,
}) => {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const storeAuth = useAuthStore((st) => st.isAuthenticated);
  const isAuthenticated = Boolean(auth?.isAuthenticated || storeAuth);

  const handleBookNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bookPath = `/customer/book/${encodeURIComponent(id)}`;
    if (isAuthenticated) {
      navigate(bookPath);
    } else {
      navigate(`/login?returnUrl=${encodeURIComponent(bookPath)}`);
    }
  };
  const webpImage = image.replace(/\.(png|jpe?g)$/i, ".webp");

  // If the .webp file is missing, drop the <source> so the browser uses the <img> file.
  const [webpFailed, setWebpFailed] = useState(false);
  const canUseWebp = webpImage !== image && !webpFailed;

  // Display rating: if 0 or unrated, show a friendly 4.8 default or new badge
  const displayRating = rating > 0 ? rating.toFixed(1).replace(/\.0$/, "") : "4.8";

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_12px_28px_-6px_rgba(67,56,202,0.14)]">
      {/* Image container */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100">
        <picture>
          {canUseWebp && <source srcSet={webpImage} type="image/webp" />}

          <img
            src={fallbackImage || image}
            alt={safeAlt(name, "Service photo")}
            width={500}
            height={312}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            onError={(event) => {
              const img = event.currentTarget;

              if (canUseWebp) {
                // The webp failed: re-render without it and use the original file.
                setWebpFailed(true);
                return;
              }

              // Original file also failed: stop here to avoid an error loop.
              img.onerror = null;
            }}
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
          />
        </picture>

        {/* Soft top gradient scrim for badge legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 via-black/5 to-transparent" />

        {/* Category Pill Badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-tight text-indigo-700 shadow-xs backdrop-blur-md border border-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
          {category}
        </span>

        {/* Rating Badge */}
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-slate-800 shadow-xs backdrop-blur-md border border-white/60">
          <Star size={12} fill="#f59e0b" className="text-amber-500" />
          <span>{displayRating}</span>
          <span className="text-[10px] font-medium text-slate-400">
            {rating > 0 ? "★" : "(New)"}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          {/* Service Name */}
          <h3 className="text-[16px] sm:text-[17px] font-extrabold text-slate-900 transition-colors group-hover:text-indigo-600 line-clamp-1">
            {name}
          </h3>

          {/* Micro Trust & Duration Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
              <Clock size={11} className="text-indigo-600" />
              <span>{duration}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">
              <ShieldCheck size={11} className="text-emerald-600" />
              <span>Verified Pro</span>
            </span>
          </div>

          {/* Price + Duration Stats */}
          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Starting from
              </p>
              <p className="text-lg font-black tracking-tight text-slate-900">
                ₹{price}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Standard Time
              </p>
              <p className="text-xs font-bold text-slate-700">
                {duration}
              </p>
            </div>
          </div>
        </div>

        {/* Dual Actions CTA: View Details + Book Now side-by-side */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to={`/services/${encodeURIComponent(id)}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-xs sm:text-sm font-bold text-indigo-700 shadow-2xs transition-all duration-200 hover:bg-indigo-100 hover:border-indigo-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span>View Details</span>
          </Link>

          <button
            type="button"
            onClick={handleBookNow}
            className="group/btn flex items-center justify-center gap-1.5 rounded-xl bg-[#ff8a3d] px-3 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition duration-300 hover:bg-[#f97316] hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#ff8a3d]/50 cursor-pointer"
          >
            <span>Book Now</span>
            <ArrowRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default ServiceCard;
