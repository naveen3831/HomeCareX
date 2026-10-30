import { z } from 'zod';

/**
 * Zod schemas for the public catalog. They mirror src/types/catalog.ts
 * (backend/src/modules/catalog/catalog.types.ts), so what we validate here is
 * exactly what the backend contract promises.
 *
 * Banners are the one exception: GET /banners is not part of catalog.types.ts yet,
 * so bannerSchema follows the shape BannerSlider already renders. Confirm it with the owner.
 */

// IDs may arrive as number or string; normalise to string.
const id = z.union([z.string(), z.number()]).transform(String);

/* ----------------------------- categories ----------------------------- */

export const categorySchema = z.object({
  id,
  name: z.string(),
  slug: z.string(),
  description: z.string().default(''),
  icon: z.string().default(''),
  sortOrder: z.number().default(0),
  serviceCount: z.number().default(0),
});
export const categoriesSchema = z.array(categorySchema);

/* ------------------------------ services ------------------------------ */

const categoryRefSchema = z.object({ id, name: z.string(), slug: z.string() });

export const serviceSchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  description: z.string().default(''),
  icon: z.string().default(''),
  category: categoryRefSchema,
  basePrice: z.number(),
  durationMinutes: z.number().default(0),
  rating: z.number().default(0),
  ratingCount: z.number().default(0),
  availability: z.enum(['today', 'tomorrow', 'scheduled']).default('scheduled'),
  /** Not in the contract yet. Used if the backend adds it; otherwise the UI falls back to a category image. */
  imageUrl: z.string().nullish(),
});

export const pageMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const servicesPageSchema = z.object({
  items: z.array(serviceSchema),
  meta: pageMetaSchema,
});

export const serviceDetailSchema = serviceSchema.extend({
  media: z.array(z.object({ url: z.string(), alt: z.string().default('') })).default([]),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  addOns: z.array(z.object({ id, name: z.string(), price: z.number() })).default([]),
  faqs: z.array(z.object({ id, question: z.string(), answer: z.string() })).default([]),
  slotAvailability: z
    .object({
      windowDays: z.number().default(7),
      hasSlots: z.boolean().nullable().default(null),
      nextAvailableDate: z.string().nullable().default(null),
    })
    .default({ windowDays: 7, hasSlots: null, nextAvailableDate: null }),
});

/* ------------------------------- reviews ------------------------------ */

export const reviewSchema = z.object({
  id,
  rating: z.number().min(1).max(5),
  comment: z.string().default(''),
  author: z.string(),
  verified: z.boolean().default(false),
  createdAt: z.string(),
});

export const reviewSummarySchema = z.object({
  average: z.number().default(0),
  count: z.number().default(0),
  distribution: z.object({
    '1': z.number().default(0),
    '2': z.number().default(0),
    '3': z.number().default(0),
    '4': z.number().default(0),
    '5': z.number().default(0),
  }),
});

export const reviewsPageSchema = z.object({
  summary: reviewSummarySchema,
  reviews: z.array(reviewSchema),
  meta: pageMetaSchema,
});

/* ------------------------------- banners ------------------------------ */

export const bannerSchema = z.object({
  id,
  category: z.string().default(''),
  title: z.string(),
  description: z.string().default(''),
  image: z.string(),
  alt: z.string().default(''),
  link: z.string().default('/services'),
});
export const bannersSchema = z.array(bannerSchema);

/* -------------------------------- types ------------------------------- */

export type Category = z.infer<typeof categorySchema>;
export type Service = z.infer<typeof serviceSchema>;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type PageMeta = z.infer<typeof pageMetaSchema>;
export type ServicesPage = z.infer<typeof servicesPageSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type ReviewsPage = z.infer<typeof reviewsPageSchema>;
export type Banner = z.infer<typeof bannerSchema>;

export type ServiceSort = 'order' | 'popular' | 'rating' | 'price-asc' | 'price-desc' | 'newest' | 'relevance';
export type BannerPlacement = 'home';

/** Query params accepted by GET /services (same as ServiceListParams in types/catalog.ts). */
export interface ServicesParams {
  q?: string;
  /** Category slug (the API also accepts an id). */
  category?: string;
  rating?: number;
  minPrice?: number;
  maxPrice?: number;
  /** Longest acceptable duration, in minutes. */
  duration?: number;
  availability?: 'today' | 'tomorrow';
  sort?: ServiceSort;
  page?: number;
  limit?: number;
}

export interface ReviewsParams {
  page?: number;
  limit?: number;
}
