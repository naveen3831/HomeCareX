import clsx from "clsx";
import type { CatalogService } from "@/types/catalog";
import { ServiceCard } from "./ServiceCard";
import { ServiceCardSkeleton } from "./ServiceCardSkeleton";

const GRID = "grid gap-3.5 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

interface Props {
  services: CatalogService[];
  /** The previous page is still showing while the next one loads. */
  busy?: boolean;
}

export function ServiceGrid({ services, busy = false }: Props) {
  const seen = new Set<string>();
  const unique = services.filter((s) => {
    if (!s.id || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  return (
    <ul aria-busy={busy} className={clsx(GRID, "transition-opacity duration-150", busy && "opacity-60")}>
      {unique.map((s, i) => (
        <li key={s.id}>
          <ServiceCard service={s} index={i} />
        </li>
      ))}
    </ul>
  );
}

/** First load: same grid shape as ServiceGrid so nothing jumps. */
export function ServiceGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading services…</span>
      <ul className={GRID} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <ServiceCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
