import type {
  Banner,
  Category,
  ReviewsPage,
  ServiceDetail,
  ServicesPage,
} from "@/features/public/schemas";

type ServiceItem = ServicesPage["items"][number];

// ============================================================
// Existing exports (unchanged, so other files keep working)
// ============================================================

export interface MockCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  serviceCount: number;
  link: string;
}

export const POPULAR_CATEGORIES: MockCategory[] = [
  { id: "CAT001", name: "Home Cleaning", description: "Professional cleaning services for your home.", image: "/images/categories/home-cleaning.jpg", serviceCount: 12, link: "/services?category=home-cleaning" },
  { id: "CAT002", name: "Electrical", description: "Reliable electrical services for your home.", image: "/images/categories/electrical.jpg", serviceCount: 10, link: "/services?category=electrical" },
  { id: "CAT003", name: "Plumbing", description: "Quick and reliable plumbing services.", image: "/images/categories/plumbing.jpg", serviceCount: 8, link: "/services?category=plumbing" },
  { id: "CAT004", name: "AC Repair", description: "Professional AC repair and maintenance.", image: "/images/categories/ac-repair.jpg", serviceCount: 6, link: "/services?category=ac-repair" },
];

export interface MockService {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  duration: string;
  rating: number;
  reviewCount: number;
}

export const SERVICES: MockService[] = [
  { id: "SRV001", name: "Deep Home Cleaning", description: "Complete deep cleaning service for your home.", categoryId: "CAT001", price: 1499, duration: "3 hrs", rating: 4.8, reviewCount: 214 },
  { id: "SRV002", name: "Sofa Cleaning", description: "Professional sofa and upholstery cleaning.", categoryId: "CAT001", price: 899, duration: "1.5 hrs", rating: 4.7, reviewCount: 156 },
  { id: "SRV003", name: "Electrical Repair", description: "General electrical repair and installation.", categoryId: "CAT002", price: 499, duration: "1 hr", rating: 4.6, reviewCount: 128 },
  { id: "SRV004", name: "Plumbing Repair", description: "Reliable plumbing repair and maintenance.", categoryId: "CAT003", price: 399, duration: "1 hr", rating: 4.5, reviewCount: 112 },
  { id: "SRV005", name: "AC Service", description: "AC servicing and maintenance at your doorstep.", categoryId: "CAT004", price: 599, duration: "1 hr", rating: 4.6, reviewCount: 187 },
];

export interface MockBanner {
  id: string;
  title: string;
  description: string;
  image: string;
  buttonText: string;
  link: string;
}

export const BANNERS: MockBanner[] = [
  { id: "BAN001", title: "Professional Home Services", description: "Book trusted professionals for your home.", image: "/images/banners/home-service.jpg", buttonText: "Book Now", link: "/services" },
  { id: "BAN002", title: "Quality Services at Your Doorstep", description: "Easy, reliable and convenient home services.", image: "/images/banners/quality-service.jpg", buttonText: "Explore Services", link: "/services" },
];

export interface MockTestimonial {
  id: string;
  name: string;
  role: string;
  message: string;
  rating: number;
  image?: string;
}

export const TESTIMONIALS: MockTestimonial[] = [
  { id: "TEST001", name: "Anita Sharma", role: "Customer", message: "The service was quick, professional and very convenient.", rating: 5 },
  { id: "TEST002", name: "Rahul Kumar", role: "Customer", message: "I was able to book a reliable professional very easily.", rating: 5 },
  { id: "TEST003", name: "Priya Reddy", role: "Customer", message: "The overall experience was smooth and the service quality was excellent.", rating: 4 },
];

// ============================================================
// Data used by src/features/public/api.ts
// Each list is built as plain data first; the schema type is
// applied only at export, so no field lookups touch it.
// ============================================================

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** "1.5 hrs" -> 90, "1 hr" -> 60 */
const toMinutes = (d: string) => Math.round(parseFloat(d) * 60) || 60;

const categoriesBase = POPULAR_CATEGORIES.map((c, i) => ({
  id: c.id,
  name: c.name,
  slug: slugify(c.name),
  description: c.description,
  image: c.image,
  serviceCount: c.serviceCount,
  sortOrder: i + 1,
}));

const servicesBase = SERVICES.map((s) => {
  const cat = categoriesBase.find((c) => c.id === s.categoryId)!;
  return {
    id: s.id,
    slug: slugify(s.name),
    name: s.name,
    description: s.description,
    image: cat.image,
    category: { id: cat.id, name: cat.name, slug: cat.slug },
    basePrice: s.price,
    durationMinutes: toMinutes(s.duration),
    availability: "available",
    rating: s.rating,
    ratingCount: s.reviewCount,
  };
});

const serviceDetailsBase = servicesBase.map((s) => ({
  ...s,
  longDescription: `${s.description} Verified professionals arrive on time with the right tools.`,
  includes: ["Verified professional", "Standard tools", "Post-service quality check"],
  excludes: ["Spare parts and materials", "Work outside the booked scope"],
  gallery: [s.image],
  faqs: [
    { question: "How long does it take?", answer: "Usually close to the listed duration." },
    { question: "Can I reschedule?", answer: "Yes, from your bookings page before the visit." },
  ],
}));

const bannersBase = BANNERS.map((b) => ({
  id: b.id,
  title: b.title,
  subtitle: b.description,
  imageUrl: b.image,
  ctaLabel: b.buttonText,
  ctaLink: b.link,
  placement: "home",
}));

export const mockCategories = categoriesBase as unknown as Category[];
export const mockServices = servicesBase as unknown as ServiceItem[];
export const mockServiceDetails = serviceDetailsBase as unknown as ServiceDetail[];
export const mockBanners = bannersBase as unknown as Banner[];

export function mockReviewsFor(serviceId: string, page = 1, limit = 10): ReviewsPage {
  const all = TESTIMONIALS.map((t, i) => ({
    id: `REV-${serviceId}-${i + 1}`,
    author: t.name,
    rating: t.rating,
    comment: t.message,
    createdAt: new Date(2026, 8, 10 + i).toISOString(),
  }));
  const total = all.length;
  const average = total ? all.reduce((n, r) => n + r.rating, 0) / total : 0;

  return {
    summary: { average, total },
    reviews: all.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  } as unknown as ReviewsPage;
}