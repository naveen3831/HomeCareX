import type { Service, ServiceDetail } from './schemas';

/**
 * Small adapters between API shapes (types/catalog.ts) and the view shapes the
 * public pages and components already use (image, category name, price, "2-3 hrs").
 */

export interface ServiceCardData {
  id: string;
  slug: string;
  image: string;
  category: string;
  categorySlug: string;
  name: string;
  rating: number;
  price: number;
  duration: string;
}

// The category/list endpoints have no image yet, so pick one of the pictures we ship by
// matching words in the slug (real slugs look like "kitchen-appliance-care", "salon-spa").
// Categories with no matching picture get the generic one. Ask the backend for `imageUrl`.
const IMAGE_RULES: [RegExp, string][] = [
  [/clean/, '/images/home-cleaning.jpg'],
  [/electric/, '/images/electrical.jpg'],
  [/plumb/, '/images/plumbing.jpg'],
  [/paint|waterproof/, '/images/painting.jpg'],
  [/appliance|oven|microwave|kitchen|repair/, '/images/appliance-repair.jpg'],
  [/carpent|furniture|maint/, '/images/home-maintenance.jpg'],
];
export const FALLBACK_IMAGE = '/images/home-maintenance.jpg';

export const categoryImage = (slug: string) =>
  IMAGE_RULES.find(([re]) => re.test(slug.toLowerCase()))?.[1] ?? FALLBACK_IMAGE;

const ICON_RULES: [RegExp, string][] = [
  [/clean/, '🧹'],
  [/electric/, '💡'],
  [/plumb/, '🔧'],
  [/paint|waterproof/, '🎨'],
  [/appliance|oven|microwave|kitchen/, '🛠️'],
  [/carpent|furniture/, '🪚'],
  [/pest/, '🐜'],
  [/salon|spa|beauty/, '💆'],
];

/** The backend icon when it has one, otherwise an emoji picked from the slug. */
export function categoryIcon(slug: string, icon?: string | null): string {
  if (icon && icon.trim()) return icon;
  return ICON_RULES.find(([re]) => re.test(slug.toLowerCase()))?.[1] ?? '🏠';
}

/** 45 -> "45 mins", 90 -> "1.5 hrs", 120 -> "2 hrs", 1440 -> "1 day". */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Flexible';
  if (minutes < 60) return `${minutes} mins`;
  if (minutes >= 1440) {
    const days = Math.round((minutes / 1440) * 10) / 10;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
}

export function formatEarliest(detail: Pick<ServiceDetail, 'availability' | 'slotAvailability'>): string {
  if (detail.availability === 'today') return 'Today';
  if (detail.availability === 'tomorrow') return 'Tomorrow';
  const { hasSlots, nextAvailableDate } = detail.slotAvailability;
  if (nextAvailableDate) {
    const [y, m, d] = nextAvailableDate.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  return hasSlots === null ? 'Choose at booking' : 'Scheduled';
}

export function toServiceCard(s: Service): ServiceCardData {
  return {
    id: s.id,
    slug: s.slug,
    image: s.imageUrl || categoryImage(s.category.slug),
    category: s.category.name,
    categorySlug: s.category.slug,
    name: s.name,
    rating: s.rating,
    price: s.basePrice,
    duration: formatDuration(s.durationMinutes),
  };
}
