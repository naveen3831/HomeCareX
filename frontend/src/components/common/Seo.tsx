
import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

const SITE_NAME = "HomeCareX";

// Replace this with your real production domain before deployment.

const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HomeCareX",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "HomeCareX",
  url: SITE_URL,
};


export default function Seo({
  title,
  description,
  path,
  image = "/og-image.png",
  type = "website",
  noIndex = false,
}: SeoProps) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = `${SITE_URL}${normalizedPath}`;
  const imageUrl = image.startsWith("http")
    ? image
    : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />

      <link rel="canonical" href={canonicalUrl} />

      <meta
        name="robots"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      
<script type="application/ld+json">
  {JSON.stringify(organizationSchema)}
</script>

<script type="application/ld+json">
  {JSON.stringify(websiteSchema)}
</script>

    </Helmet>
  );
}
