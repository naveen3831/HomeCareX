/**
 * Photos for the dashboard's category tiles and service cards.
 * Web-sized copies live in /public/images/dashboard (the originals in /public/images stay untouched).
 * Anything not listed here falls back to the 3D icon, so a new category or service never renders empty.
 */
export interface DashboardPhoto {
  src: string;
  /** CSS object-position — keeps the subject in frame when the image is cropped to the card. */
  position: string;
}

const img = (file: string, position = "50% 50%"): DashboardPhoto => ({
  src: `${import.meta.env.BASE_URL}images/${file}`,
  position,
});

/** Keyed by category slug. Tall tiles, so positions are tuned for a portrait crop. */
const CATEGORY_PHOTOS: Record<string, DashboardPhoto> = {
  "home-cleaning": img("home-cleaning.jpg", "50% 50%"),
  "appliance-repair": img("appliance-repair.jpg", "58% 50%"),
  "appliance-repair-service": img("appliance-repair.jpg", "58% 50%"),
  "salon-spa": img("Home-spa-women-banner.jpg", "50% 34%"),
  "electrical-plumbing": img("electrical.jpg", "50% 40%"),
  painting: img("painting-category.png", "50% 45%"),
  "painting-waterproofing": img("painting-category.png", "50% 45%"),
  "pest-control": img("pest-control-clean.png", "50% 12%"),
  carpentry: img("furniture-assembly.jpg", "50% 40%"),
  "carpentry-furniture-assembly": img("furniture-assembly.jpg", "50% 40%"),
  "full-home-sanitization": img("pest-control-clean.png", "50% 12%"),
  "home-sanitization": img("pest-control-clean.png", "50% 12%"),
};

/** Curated pool of high-quality banner images to guarantee no slide or category ever renders empty */
export const CATEGORY_FALLBACK_PHOTOS: DashboardPhoto[] = [
  img("home-cleaning.jpg", "50% 50%"),
  img("appliance-repair.jpg", "58% 50%"),
  img("Home-spa-women-banner.jpg", "50% 34%"),
  img("painting-category.png", "50% 45%"),
  img("electrical.jpg", "50% 40%"),
  img("pest-control-clean.png", "50% 12%"),
  img("furniture-assembly.jpg", "50% 40%"),
];

/** Keyword-based matchers for dynamic category names or slugs */
const CATEGORY_KEYWORD_PHOTOS: [RegExp, DashboardPhoto][] = [
  [/clean|maid|sanitiz|housekeep/i, img("home-cleaning.jpg", "50% 50%")],
  [/appliance|repair|ac\b|fridge|refrigerat|washing|microwave|geyser/i, img("appliance-repair.jpg", "58% 50%")],
  [/salon|spa|beauty|hair|groom|makeup|massage|women/i, img("Home-spa-women-banner.jpg", "50% 34%")],
  [/plumb|pipe|tap|leak|water|drain/i, img("plumbing.jpg", "50% 72%")],
  [/electr|wire|switch|socket|fan|light/i, img("electrical.jpg", "50% 40%")],
  [/paint|waterproof|wall|decor/i, img("painting-category.png", "50% 45%")],
  [/pest|bug|termite|rodent|cockroach|mosquito/i, img("pest-control-clean.png", "50% 12%")],
  [/carpent|furnitur|wood|assembly|shelf|lock|maintenance/i, img("furniture-assembly.jpg", "50% 40%")],
];

function stableStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a photo for a category with multiple layers of fallback:
 * 1. Category's uploaded imageUrl (if present, excluding 3D emoji icons)
 * 2. Exact slug match in CATEGORY_PHOTOS
 * 3. Keyword match on slug or name
 * 4. Stable fallback from curated photo pool based on name/slug or index
 */
export function resolveCategoryPhoto(
  category: { slug?: string; name?: string; imageUrl?: string | null; iconUrl?: string | null },
  index = 0
): DashboardPhoto {
  if (
    category.imageUrl &&
    category.imageUrl.trim() &&
    !category.imageUrl.includes("/icons/3d/") &&
    !category.imageUrl.includes("/icons/")
  ) {
    return { src: category.imageUrl, position: "50% 50%" };
  }
  const slug = category.slug ?? "";
  if (slug && CATEGORY_PHOTOS[slug]) {
    return CATEGORY_PHOTOS[slug];
  }
  const text = `${slug} ${category.name ?? ""}`.toLowerCase();
  const matched = CATEGORY_KEYWORD_PHOTOS.find(([re]) => re.test(text));
  if (matched) {
    return matched[1];
  }
  // Stable fallback from curated pool
  const fallbackIndex = (stableStringHash(text) + index) % CATEGORY_FALLBACK_PHOTOS.length;
  return CATEGORY_FALLBACK_PHOTOS[fallbackIndex];
}

const PHOTOGRAPHED = [
  "bathroom-deep-cleaning", "kitchen-deep-cleaning", "full-home-sanitization", "washing-machine-repair",
  "refrigerator-repair", "microwave-oven-repair", "geyser-installation-repair", "water-tank-cleaning",
  "room-painting-per-room", "terrace-waterproofing", "texture-accent-wall", "mosquito-fogging",
  "bed-bug-treatment", "mens-haircut-grooming", "bridal-makeup", "full-body-massage",
];
/** Keyed by service slug. Wide crops, so these differ from the category crops on purpose. */
const SERVICE_PHOTOS: Record<string, DashboardPhoto> = {
  "ac-service-gas-refill": img("appliance-repair.jpg", "12% 50%"),
  "ro-water-purifier-service": img("plumbing.jpg", "50% 72%"),
  "deep-home-cleaning": img("home-cleaning.jpg"),
  "sofa-carpet-shampooing": img("home-cleaning.jpg"),
  "at-home-spa-for-women": img("Home-spa-women.png", "50% 40%"),
  "electrician-visit-general": img("electrical.jpg"),
  "plumbing-tap-leak-repair": img("plumbing.jpg", "50% 72%"),
  "room-painting-per-room": img("painting-category.png", "50% 45%"),
  "general-pest-control": img("pest-control-clean.png"),
  "termite-treatment": img("termite-treatment-clean.png"),
  "furniture-assembly": img("furniture-assembly.jpg", "50% 50%"),
  "door-lock-repair": img("door-lock-repair.jpg", "50% 40%"),
  "wardrobe-repair": img("wardrobe-repair.jpg", "50% 50%"),
  "custom-shelf-installation": img("custom-shelf-installation.jpg", "50% 35%"),
  "shelf-curtain-rod-installation": img("custom-shelf-installation.jpg", "50% 35%"),
      ...Object.fromEntries(PHOTOGRAPHED.map((slug) => [slug,img(`${slug}.png`)])),

};

export const categoryPhoto = (slug: string): DashboardPhoto | undefined => CATEGORY_PHOTOS[slug];
export const servicePhoto = (slug: string): DashboardPhoto | undefined => SERVICE_PHOTOS[slug];

/** Square thumbnails need a different focal point than the wide service cards. */
const THUMB_POSITIONS: Record<string, string> = {
  "ac-service-gas-refill": "58% 50%",
  "ro-water-purifier-service": "50% 60%",
  "plumbing-tap-leak-repair": "50% 60%",
  "at-home-spa-for-women": "30% 38%",
  "general-pest-control": "50% 50%",
};

/** Bookings only carry a service name, so match on its slug first, then on keywords. */
const KEYWORD_PHOTOS: [RegExp, string][] = [
  [/termite/, "termite"],
  [/pest|cockroach|rodent|mosquito/, "general-pest-control"],
  [/\bspa\b|massage|facial|salon/, "at-home-spa-for-women"],
  [/paint|waterproof/, "room-painting-per-room"],
  [/electric|wiring|switch|fan/, "electrician-visit-general"],
  [/plumb|tap|leak|pipe|geyser|tank/, "plumbing-tap-leak-repair"],
  [/sofa|carpet|shampoo/, "sofa-carpet-shampooing"],
  [/clean|sanitiz/, "deep-home-cleaning"],
  [/\b(ac|appliance|refrigerator|washing|microwave)\b|repair/, "ac-service-gas-refill"],
  [/carpent|furniture/, "furniture-assembly"],
  [/lock|door/, "door-lock-repair"],
  [/wardrobe|drawer/, "wardrobe-repair"],
  [/shelf|curtain/, "custom-shelf-installation"],
];

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Photo for a booking row (square thumbnail), or undefined so the caller can show the 3D icon. */
export function bookingPhoto(serviceName: string): DashboardPhoto | undefined {
  const slug = slugify(serviceName);
  let key = SERVICE_PHOTOS[slug] ? slug : undefined;
  if (!key) {
    const text = serviceName.toLowerCase();
    key = KEYWORD_PHOTOS.find(([re]) => re.test(text))?.[1];
  }
  const photo = key ? SERVICE_PHOTOS[key] : undefined;
  if (!photo || !key) return undefined;
  return { ...photo, position: THUMB_POSITIONS[key] ?? photo.position };
}
