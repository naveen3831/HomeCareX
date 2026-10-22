import { ROUTES } from "../src/constants/routes.ts";

export const STATIC_ROUTES: string[] = [
  ROUTES.HOME,
  ROUTES.SERVICES,
  ROUTES.ABOUT,
  ROUTES.FAQ,
  ROUTES.CONTACT,
  ROUTES.TERMS,
  ROUTES.PRIVACY,
];

/** Never in the sitemap (JS-06 business rule). */
export const EXCLUDED_ROUTES: string[] = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.VERIFY_OTP,
  ROUTES.RESET_PASSWORD,
  ROUTES.UNAUTHORIZED,
];

export interface SitemapService {
  slug?: string | null;
  isActive?: boolean;
  status?: string;
}

export interface SitemapCategory {
  slug?: string | null;
}

export function isActiveService(service: SitemapService): boolean {
  if (!service.slug || !service.slug.trim()) return false;
  if (service.isActive === false) return false;
  if (service.status && service.status.toLowerCase() !== "active") return false;
  return true;
}

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const cleanSite = (siteUrl: string) => siteUrl.replace(/\/+$/, "");

const isExcluded = (path: string): boolean => {
  const pathname = path.split("?")[0];
  return EXCLUDED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
};

export function buildUrlList(
  siteUrl: string,
  services: SitemapService[],
  categories: SitemapCategory[] = [],
): string[] {
  const site = cleanSite(siteUrl);
  const paths: string[] = [...STATIC_ROUTES];

  const categorySlugs = [
    ...new Set(
      categories
        .map((c) => c.slug?.trim())
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ].sort();
  for (const slug of categorySlugs) {
    paths.push(`${ROUTES.SERVICES}?category=${encodeURIComponent(slug)}`);
  }

  const serviceSlugs = [
    ...new Set(
      services.filter(isActiveService).map((s) => (s.slug as string).trim()),
    ),
  ].sort();
  for (const slug of serviceSlugs) {
    paths.push(`${ROUTES.SERVICES}/${encodeURIComponent(slug)}`);
  }

  const urls = paths
    .filter((path) => !isExcluded(path))
    .map((path) => (path === ROUTES.HOME ? `${site}/` : `${site}${path}`));

  return [...new Set(urls)];
}

export function buildSitemapXml(
  siteUrl: string,
  services: SitemapService[],
  categories: SitemapCategory[] = [],
): string {
  const body = buildUrlList(siteUrl, services, categories)
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

export function withSitemapLine(robotsTxt: string, siteUrl: string): string {
  const eol = robotsTxt.includes("\r\n") ? "\r\n" : "\n";
  const line = `Sitemap: ${cleanSite(siteUrl)}/sitemap.xml`;
  if (/^Sitemap:.*$/im.test(robotsTxt)) {
    return robotsTxt.replace(/^Sitemap:.*$/im, line);
  }
  return `${robotsTxt.replace(/\s+$/, "")}${eol}${eol}${line}${eol}`;
}