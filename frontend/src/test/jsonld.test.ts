import { describe, expect, it } from "vitest";

import { breadcrumbLd, faqLd, organizationLd, serviceLd, websiteLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/seo";

const service = {
  slug: "deep-home-cleaning",
  name: "Deep Home Cleaning",
  description: "Complete  deep cleaning\nfor your home.",
  basePrice: 1499,
  rating: 4.8,
  ratingCount: 214,
  category: { name: "Home Cleaning" },
  media: [{ url: "/images/deep-cleaning.jpg" }],
};

describe("serviceLd", () => {
  it("is built from the real service data", () => {
    const ld = serviceLd(service) as Record<string, any>;
    expect(ld["@type"]).toBe("Service");
    expect(ld.name).toBe("Deep Home Cleaning");
    expect(ld.description).toBe("Complete deep cleaning for your home.");
    expect(ld.serviceType).toBe("Home Cleaning");
    expect(ld.image).toBe(`${SITE_URL}/images/deep-cleaning.jpg`);
    expect(ld.offers).toMatchObject({ price: 1499, priceCurrency: "INR" });
  });

  it("never emits ratings unless the caller opts in", () => {
    expect(serviceLd(service) as Record<string, unknown>).not.toHaveProperty("aggregateRating");
  });

  it("emits aggregateRating only for real ratings", () => {
    const ok = serviceLd(service, { includeRating: true }) as Record<string, any>;
    expect(ok.aggregateRating).toMatchObject({ ratingValue: 4.8, reviewCount: 214 });
    const none = serviceLd({ ...service, rating: 0, ratingCount: 0 }, { includeRating: true }) as Record<string, unknown>;
    expect(none).not.toHaveProperty("aggregateRating");
  });

  it("never contains a review", () => {
    expect(JSON.stringify(serviceLd(service, { includeRating: true }))).not.toMatch(/"review"|"@type":"Review"/);
  });

  it("skips price and image when the data has none", () => {
    const ld = serviceLd({ slug: "x", name: "X", basePrice: 0 }) as Record<string, unknown>;
    expect(ld).not.toHaveProperty("offers");
    expect(ld).not.toHaveProperty("image");
  });
});

describe("site-wide and page schemas", () => {
  it("builds Organization and WebSite", () => {
    expect(organizationLd()).toMatchObject({ "@type": "Organization", url: SITE_URL });
    expect(websiteLd()).toMatchObject({ "@type": "WebSite", url: SITE_URL });
  });

  it("numbers breadcrumb items from 1 with absolute URLs", () => {
    const ld = breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
    ]) as Record<string, any>;
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1].item).toBe(`${SITE_URL}/services`);
  });

  it("builds FAQPage, and nothing when there are no questions", () => {
    const ld = faqLd([{ question: "Q?", answer: "A." }]) as Record<string, any>;
    expect(ld["@type"]).toBe("FAQPage");
    expect(faqLd([])).toBeNull();
  });
});