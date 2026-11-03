import React from "react";

const ServiceCardSkeleton: React.FC = () => {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs"
      aria-hidden="true"
    >
      {/* Image Skeleton with matching compact 16/10 aspect */}
      <div className="aspect-[16/10] animate-pulse bg-slate-200/80" />

      {/* Content Skeleton */}
      <div className="space-y-3.5 p-4 sm:p-5">
        {/* Service Name */}
        <div className="h-4.5 w-3/4 animate-pulse rounded-md bg-slate-200/80" />

        {/* Micro Badges */}
        <div className="flex gap-2">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="space-y-1">
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200/70" />
            <div className="h-5 w-14 animate-pulse rounded bg-slate-200/80" />
          </div>
          <div className="space-y-1 text-right">
            <div className="ml-auto h-2.5 w-16 animate-pulse rounded bg-slate-200/70" />
            <div className="ml-auto h-4 w-12 animate-pulse rounded bg-slate-200/80" />
          </div>
        </div>

        {/* Full-width CTA button skeleton */}
        <div className="h-9.5 w-full animate-pulse rounded-xl bg-slate-200/80" />
      </div>
    </div>
  );
};

export default ServiceCardSkeleton;
