import { describe, expect, it } from "vitest";

import robotsTxt from "../../public/robots.txt?raw";
import {
  EXCLUDED_ROUTES,
  STATIC_ROUTES,
  buildSitemapXml,
  buildUrlList,
  escapeXml,
  withSitemapLine,
} from "../../scripts/sitemap-core";

const SITE = "https://homecarex.example";

const services = [
  { slug: "ac-repair", isActive: true },
  { slug: "deep-home-cleaning", status: "active" },
  { slug: "sofa & chair cleaning" },
  { slug: "old-service", isActive: false },
  { slug: "paused", status: "inactive" },
  { slug: "" },
  { slug: null },
  { slug: "ac-repair" },
];
const categories = [{ slug: "plumbing" }, { slug: "home-cleaning" }, { slug: "" }];

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const locs = (xml: string) =>
  Array.from(parse(xml).getElementsByTagName("loc")).map((n) => n.textContent ?? "");

describe("sitemap.xml", () => {
  const xml = buildSitemapXml(SITE, services, categories);

  it("is well-formed sitemap XML", () => {
    const doc = parse(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.localName).toBe("urlset");
    expect(doc.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    for (const url of Array.from(doc.getElementsByTagName("url"))) {
      expect(url.getElementsByTagName("loc")).toHaveLength(1);
    }
    for (const loc of locs(xml)) {
      expect(loc).toMatch(/^https:\/\/homecarex\.example(\/|$)/);
    }
  });

  it("lists every active service slug exactly once", () => {
    const found = locs(xml);
    expect(found).toContain(`${SITE}/services/ac-repair`);
    expect(found).toContain(`${SITE}/services/deep-home-cleaning`);
    expect(found).toContain(`${SITE}/services/sofa%20%26%20chair%20cleaning`);
    expect(found.filter((u) => u.endsWith("/services/ac-repair"))).toHaveLength(1);
  });

  it("leaves out inactive or slug-less services", () => {
    const found = locs(xml).join("\n");
    expect(found).not.toContain("old-service");
    expect(found).not.toContain("paused");
    expect(locs(xml).filter((u) => u.endsWith("/services/"))).toHaveLength(0);
  });

  it("lists the public pages and one URL per category", () => {
    const found = locs(xml);
    expect(found).toContain(`${SITE}/`);
    for (const route of STATIC_ROUTES.filter((r) => r !== "/")) {
      expect(found).toContain(`${SITE}${route}`);
    }
    expect(found).toContain(`${SITE}/services?category=plumbing`);
    expect(found).toContain(`${SITE}/services?category=home-cleaning`);
  });

  it("never lists auth routes", () => {
    const paths = locs(xml).map((u) => new URL(u).pathname);
    for (const route of EXCLUDED_ROUTES) {
      expect(paths).not.toContain(route);
    }
  });

  it("never lists dashboards", () => {
    for (const u of locs(xml)) {
      expect(new URL(u).pathname).not.toMatch(/^\/(admin|partner|customer)(\/|$)/);
    }
  });

  it("is stable and tolerates a trailing slash on the site URL", () => {
    expect(buildSitemapXml(`${SITE}/`, services, categories)).toBe(xml);
    expect(buildUrlList(SITE, [], [])).toHaveLength(STATIC_ROUTES.length);
  });

  it("escapes XML special characters", () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
  });
});

describe("robots.txt", () => {
  it("blocks every private path", () => {
    const blockedRoutes = [
      ...EXCLUDED_ROUTES.filter((r) => r !== "/login"),
      "/admin",
      "/partner",
      "/customer",
      "/api/",
    ];
    expect(robotsTxt).not.toMatch(/^Disallow: \/login\s*$/m);
    for (const path of blockedRoutes) {
      expect(robotsTxt).toMatch(new RegExp(`^Disallow: ${path}\\s*$`, "m"));
    }
  });

  it("does not block public pages and points at the sitemap", () => {
    expect(robotsTxt).not.toMatch(/^Disallow: \/(services|about|faq|contact)?\s*$/m);
    expect(robotsTxt).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml\s*$/m);
  });

  it("withSitemapLine rewrites or adds the Sitemap line", () => {
    const out = withSitemapLine("User-agent: *\r\nSitemap: http://old/sitemap.xml\r\n", SITE);
    expect(out).toBe(`User-agent: *\r\nSitemap: ${SITE}/sitemap.xml\r\n`);
    expect(withSitemapLine("User-agent: *\n", SITE)).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});