import { Skeleton } from "@/components/customer/Skeleton";

/** Placeholder rows shaped like the review lists, so the page never flashes blank while loading. */
export function ReviewsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line">
      <span className="sr-only">Loading reviews…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 px-4 py-5 sm:px-6">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
