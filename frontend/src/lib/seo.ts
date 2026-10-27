import { categoryImage } from '../features/public/presentation';

export const SITE_NAME = "HomeCareX";

/** Used when a page has no image and no category. Lives in /public. */
export const DEFAULT_OG_IMAGE = "/og-image.png";

const configuredSiteUrl = import.meta.env.VITE_SITE_URL as string | undefined;

export const SITE_URL = (
  configuredSiteUrl ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000")
).replace(/\/+$/, "");

export const absoluteUrl = (pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

/**
 * Canonical URL: drops every query param, except ?category on /services.
 * Trailing slashes are removed (home stays "/").
 */
export function buildCanonical(pathname: string, search = ""): string {
  const path =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname || "/";

  if (path === "/services") {
    const category = new URLSearchParams(search).get("category")?.trim();
    if (category) {
      return `${SITE_URL}${path}?category=${encodeURIComponent(category)}`;
    }
  }
  return `${SITE_URL}${path}`;
}

/** Real image -> category picture -> site default. */
export function getOgImage(image?: string | null, categorySlug?: string | null): string {
  const own = image?.trim();
  if (own) return absoluteUrl(own);
  if (categorySlug?.trim()) return absoluteUrl(categoryImage(categorySlug));
  return absoluteUrl(DEFAULT_OG_IMAGE);
}

export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** "home-cleaning" -> "Home Cleaning" */
export const slugToTitle = (slug: string): string =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");