import type { CatalogCategory } from "@/types/catalog";
import { CategoryCard } from "./CategoryCard";

export const hasLeadTile = (_n: number) => false;

export const categoryGridClass = (_lead = false) =>
  "grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 md:gap-4 lg:gap-4.5 xl:gap-5";

/**
 * Clean, symmetric 2-column grid on mobile matching the modern design,
 * gracefully expanding to 3 columns on tablet and desktop.
 */
export function CategoryGrid({ categories }: { categories: CatalogCategory[] }) {
  return (
    <ul className={categoryGridClass()}>
      {categories.map((c, i) => (
        <li key={c.id} className="h-full">
          <CategoryCard category={c} index={i} />
        </li>
      ))}
    </ul>
  );
}
