import { describe, expect, it } from "vitest";

import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
  buildCanonical,
  getOgImage,
  slugToTitle,
  truncate,
} from "@/lib/seo";

describe("buildCanonical", () => {
  it("keeps only ?category on /services and drops every filter param", () => {
    expect(
      buildCanonical("/services", "?category=plumbing&q=tap&sort=price-asc&page=2&minPrice=100&rating=4"),
    ).toBe(`${SITE_URL}/services?category=plumbing`);
  });

  it("has no query string when there is no category", () => {
    expect(buildCanonical("/services", "?sort=rating&page=3")).toBe(`${SITE_URL}/services`);
    expect(buildCanonical("/services", "?category=")).toBe(`${SITE_URL}/services`);
  });

  it("ignores ?category on other pages", () => {
    expect(buildCanonical("/about", "?category=x&utm_source=ad")).toBe(`${SITE_URL}/about`);
  });

  it("removes trailing slashes but keeps home as /", () => {
    expect(buildCanonical("/services/", "")).toBe(`${SITE_URL}/services`);
    expect(buildCanonical("/services/ac-repair///", "?utm=1")).toBe(`${SITE_URL}/services/ac-repair`);
    expect(buildCanonical("/", "?ref=x")).toBe(`${SITE_URL}/`);
  });
});

describe("getOgImage", () => {
  it("prefers the real image and makes it absolute", () => {
    expect(getOgImage("/images/real.jpg", "plumbing")).toBe(`${SITE_URL}/images/real.jpg`);
    expect(getOgImage("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });

  it("falls back to a picture for the category", () => {
    expect(getOgImage(undefined, "plumbing")).toBe(`${SITE_URL}/images/plumbing.jpg`);
    expect(getOgImage(null, "electrical")).not.toBe(getOgImage(null, "plumbing"));
  });

  it("uses the site default with no image and no category", () => {
    expect(getOgImage()).toBe(absoluteUrl(DEFAULT_OG_IMAGE));
  });
});

describe("text helpers", () => {
  it("truncates at a word boundary", () => {
    const out = truncate("word ".repeat(100), 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });

  it("turns slugs into titles", () => {
    expect(slugToTitle("home-cleaning")).toBe("Home Cleaning");
  });
});