import { Skeleton } from "../Skeleton";

export function ServiceCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-panel p-2 sm:p-2.5" aria-hidden="true">
      <Skeleton className="aspect-[16/10] w-full shrink-0 rounded-[19px]" />
      <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1 pt-2.5">
        <div className="min-h-[2.5rem] space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="mt-1 h-3 w-1/3" />
        <div className="mt-2.5 flex items-center gap-3">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3.5 w-14" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
