import { Skeleton } from "../Skeleton";

export function ServiceCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[18px] sm:rounded-[20px] border border-line/80 bg-panel p-2"
      aria-hidden="true"
    >
      <Skeleton className="aspect-[16/10] w-full shrink-0 rounded-[14px] sm:rounded-[15px]" />
      <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 pt-2">
        <div className="min-h-[2.25rem] space-y-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <Skeleton className="mt-0.5 h-2.5 w-1/3" />
        <div className="mt-2 flex items-center gap-2.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="space-y-0.5">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-4.5 w-14" />
          </div>
          <Skeleton className="h-7 w-18 rounded-full" />
        </div>
      </div>
    </div>
  );
}
