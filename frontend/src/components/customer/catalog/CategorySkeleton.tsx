import { categoryGridClass } from "./CategoryGrid";

/**
 * Skeleton that matches the redesigned card layout to prevent UI shifts during data fetching.
 */
export function CategorySkeleton() {
  return (
    <div className={categoryGridClass()} aria-busy="true" aria-label="Loading categories">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-[16px] sm:rounded-[18px] border border-slate-100 bg-white shadow-xs animate-pulse"
        >
          <div className="relative aspect-[16/10] w-full bg-slate-100">
            <div className="absolute left-2.5 bottom-2.5 sm:left-3 sm:bottom-3 h-8 w-8 sm:h-8.5 sm:w-8.5 md:h-9 md:w-9 rounded-xl bg-slate-200" />
          </div>
          <div className="flex items-center justify-between p-2.5 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3 min-h-[46px] sm:min-h-[48px] md:min-h-[50px]">
            <div className="h-3.5 w-3/4 rounded-full bg-slate-200" />
            <div className="h-4 w-4 rounded-full bg-slate-200/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
