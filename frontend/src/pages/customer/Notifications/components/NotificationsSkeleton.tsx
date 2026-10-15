import { Skeleton } from "@/components/customer/Skeleton";

export function NotificationsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line">
      <span className="sr-only">Loading notifications…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 px-4 py-4 sm:px-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
