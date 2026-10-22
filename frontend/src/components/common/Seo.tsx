import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

import type { JsonLd } from "../../lib/jsonld";
import {
  SITE_NAME,
  buildCanonical,
  getOgImage,
  truncate,
} from "../../lib/seo";

type JsonLdProp = JsonLd | null | undefined | (JsonLd | null | undefined)[];

interface SeoProps {
  title: string;
  description: string;
  /** Overrides the pathname used for the canonical URL. Defaults to the current route. */
  path?: string;
  /** Real image of the page (for example the service photo). */
  image?: string;
  /** Category slug. Picks the OG fallback picture when `image` is missing. */
  category?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  jsonLd?: JsonLdProp;
}

/** "<" is escaped so content can never close the script tag early. */
const toScript = (data: JsonLd) =>
  JSON.stringify(data).replace(/</g, "\\u003c");

export default function Seo({
  title,
  description,
  path,
  image,
  category,
  type = "website",
  noIndex = false,
  jsonLd,
}: SeoProps) {
  const location = useLocation();

  const canonicalUrl = buildCanonical(path ?? location.pathname, location.search);
  const imageUrl = getOgImage(image, category);
  const metaDescription = truncate(description);

  const schemas = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(
    (item): item is JsonLd => Boolean(item),
  );

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={canonicalUrl} />
      <meta
        name="robots"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />

      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {toScript(schema)}
        </script>
      ))}
    </Helmet>
  );
}