import { SITE_NAME, SITE_URL, absoluteUrl } from "./seo";

export type JsonLd = Record<string, unknown>;

const CONTEXT = "https://schema.org";

export const organizationLd = (): JsonLd => ({
  "@context": CONTEXT,
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl("/logo.png"),
});

export const websiteLd = (): JsonLd => ({
  "@context": CONTEXT,
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/services?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

export interface ServiceLdInput {
  slug: string;
  name: string;
  description?: string | null;
  basePrice?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  category?: { name: string } | null;
  imageUrl?: string | null;
  media?: { url: string }[] | null;
}

export interface ServiceLdOptions {
  fallbackImage?: string | null;
  /** true only when rating/ratingCount come from real stored reviews */
  includeRating?: boolean;
}

export function serviceLd(
  service: ServiceLdInput,
  { fallbackImage, includeRating = false }: ServiceLdOptions = {},
): JsonLd {
  const url = `${SITE_URL}/services/${encodeURIComponent(service.slug)}`;
  const image = service.imageUrl || service.media?.[0]?.url || fallbackImage;
  const description = service.description?.replace(/\s+/g, " ").trim();
  const hasPrice =
    typeof service.basePrice === "number" &&
    Number.isFinite(service.basePrice) &&
    service.basePrice > 0;
  const hasRating =
    includeRating &&
    typeof service.rating === "number" &&
    typeof service.ratingCount === "number" &&
    service.ratingCount > 0 &&
    service.rating > 0;

  return {
    "@context": CONTEXT,
    "@type": "Service",
    name: service.name,
    ...(description ? { description } : {}),
    ...(service.category?.name ? { serviceType: service.category.name } : {}),
    ...(image ? { image: absoluteUrl(image) } : {}),
    url,
    provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(hasPrice
      ? {
          offers: {
            "@type": "Offer",
            price: service.basePrice,
            priceCurrency: "INR",
            url,
          },
        }
      : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: service.rating,
            reviewCount: service.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export const breadcrumbLd = (items: { name: string; path: string }[]): JsonLd => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

/** null when there are no questions, so no empty FAQPage is published */
export function faqLd(
  faqs: { question: string; answer: string }[],
): JsonLd | null {
  const valid = faqs.filter((f) => f.question.trim() && f.answer.trim());
  if (valid.length === 0) return null;
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: valid.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}