import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Headset, LayoutGrid } from "lucide-react";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { EmptyState, ErrorState, OfflineState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { CategoryGrid, CategorySearch, CategorySkeleton, MostBooked } from "@/components/customer/catalog";
import { useCategories } from "@/hooks/useCategories";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Order prioritized to match the requested design mockup */
const PREFERRED_ORDER = [
  "appliance-repair-service",
  "appliance-repair",
  "salon-spa",
  "home-cleaning",
  "electrical-plumbing",
  "painting-waterproofing",
  "painting",
  "pest-control",
  "carpentry-furniture-assembly",
  "carpentry",
];

const getPriority = (slug: string) => {
  const s = slug.toLowerCase();
  const idx = PREFERRED_ORDER.findIndex(
    (p) => p === s || s.includes(p) || p.includes(s),
  );
  return idx === -1 ? 999 : idx;
};

/**
 * Categories page:
 * - Prominent "What do you need done today?" headline
 * - Subtitle "Explore our wide range of home services"
 * - Pill-shaped search bar
 * - 2-column grid of image cards with bottom-left floating badges and right chevrons
 */
export default function Categories() {
  const [query, setQuery] = useState("");
  const { data, isPending, isError, error, refetch } = useCategories();
  const online = useOnlineStatus();

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    const raw = (data ?? []).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
    const seen = new Set<string>();
    const deduplicated = raw.filter((c) => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Sort by preferred mockup order while preserving custom orders
    return deduplicated.sort((a, b) => {
      const pA = getPriority(a.slug);
      const pB = getPriority(b.slug);
      if (pA !== pB) return pA - pB;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [data, q]);

  let body;
  if (isPending) {
    body = <CategorySkeleton />;
  } else if (isError || !data) {
    body =
      !online ||
      (error instanceof Error &&
        "code" in error &&
        error.code === "NETWORK_ERROR") ? (
        <OfflineState onRetry={() => void refetch()} />
      ) : (
        <ErrorState
          title="We couldn't load categories"
          message={error?.message}
          onRetry={() => void refetch()}
        />
      );
  } else if (data.length === 0) {
    body = (
      <EmptyState
        icon={LayoutGrid}
        title="No categories yet"
        description="New service categories are on the way. Please check back soon."
      />
    );
  } else if (categories.length === 0) {
    body = (
      <EmptyState
        title={`No categories match "${query.trim()}"`}
        description="Try a different word, or tell us what you need and we'll arrange it."
        action={
          <button
            type="button"
            onClick={() => setQuery("")}
            className={clsx(
              "min-h-[44px] rounded-full bg-brand px-5 text-sm font-semibold text-white",
              FOCUS_RING,
            )}
          >
            Clear search
          </button>
        }
      />
    );
  } else {
    body = <CategoryGrid categories={categories} />;
  }

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
      {/* Page Title & Subtitle + Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <header>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            What do you need done today?
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Explore our wide range of home services
          </p>
        </header>

        <CategorySearch
          value={query}
          onChange={setQuery}
          className="w-full md:w-[360px] lg:w-[400px] md:shrink-0"
        />
      </div>

      {/* Categories Grid */}
      <div>{body}</div>

      {/* Most Booked Services */}
      {!q && data && data.length > 0 && (
        <div className="pt-3">
          <MostBooked />
        </div>
      )}

      {/* Support Escape Hatch */}
      {!q && data && data.length > 0 && (
        <section className="mt-6 flex flex-col gap-3 rounded-[20px] bg-gradient-to-br from-[#3730A3] via-brand to-[#6558E8] p-4 text-white shadow-[0_12px_28px_-12px_rgba(67,56,202,.5)] sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"
            >
              <Headset className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold md:text-base">
                Can't find what you need?
              </h2>
              <p className="text-xs text-white/80">
                Tell us and we'll arrange a verified professional.
              </p>
            </div>
          </div>
          <Link
            to={customerPath("/support")}
            className={clsx(
              "inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-xs sm:text-sm font-semibold text-[#3A1A00] transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95",
              FOCUS_RING,
            )}
          >
            Contact support
          </Link>
        </section>
      )}
    </div>
  );
}
