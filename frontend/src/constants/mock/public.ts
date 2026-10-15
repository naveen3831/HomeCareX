import type {
  Banner,
  Category,
  ReviewsPage,
  Review,
  ServiceDetail,
} from '@/features/public/schemas';

/**
 * Mock data for the public catalog. Used when VITE_USE_MOCKS=true.
 * Shapes are identical to the real API (see types/catalog.ts), so switching the flag
 * needs no UI changes.
 */

/* ------------------------------ categories ------------------------------ */

const cat = (
  id: string, slug: string, name: string, icon: string, description: string, sortOrder: number, serviceCount: number,
): Category => ({ id, slug, name, icon, description, sortOrder, serviceCount });

export const mockCategories: Category[] = [
  cat('c1', 'home-cleaning', 'Home Cleaning', '✨', 'Professional cleaning to keep your home fresh, hygienic and comfortable.', 1, 4),
  cat('c2', 'plumbing', 'Plumbing Services', '🔧', 'Reliable help with leaks, repairs, installations and maintenance.', 2, 1),
  cat('c3', 'electrical', 'Electrical Services', '⚡', 'Safe, professional electrical work for every room in your home.', 3, 1),
  cat('c4', 'painting', 'Painting Services', '🎨', 'Clean, careful painting that gives your home a fresh new look.', 4, 1),
  cat('c5', 'appliance-repair', 'Appliance Repair', '🛠️', 'Quick, dependable repairs for your household appliances.', 5, 1),
  cat('c6', 'home-maintenance', 'Home Maintenance', '🏠', 'Regular upkeep that keeps your home safe and comfortable.', 6, 1),
];

const ref = (slug: string) => {
  const c = mockCategories.find((x) => x.slug === slug)!;
  return { id: c.id, name: c.name, slug: c.slug };
};

/* ------------------------------- services ------------------------------- */

interface Seed {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  minutes: number;
  rating: number;
  ratingCount: number;
  availability: 'today' | 'tomorrow' | 'scheduled';
  description: string;
  image: string;
  included: string[];
  excluded: string[];
  addOns: { name: string; price: number }[];
  faqs: { q: string; a: string }[];
  /** Review counts for 5, 4, 3, 2, 1 stars. */
  stars: [number, number, number, number, number];
}

const seeds: Seed[] = [
  {
    id: 's1', slug: 'home-cleaning', name: 'Home Cleaning', category: 'home-cleaning', price: 499, minutes: 150, rating: 4.8, ratingCount: 312, availability: 'today',
    description: 'Professional home cleaning service to keep your home fresh, clean and comfortable.', image: '/images/home-cleaning.jpg',
    included: ['Dusting of furniture and surfaces', 'Floor sweeping and mopping', 'Bathroom and kitchen surface cleaning'],
    excluded: ['Deep stain removal', 'Cleaning of high ceilings and outside windows'],
    addOns: [{ name: 'Inside fridge cleaning', price: 249 }, { name: 'Balcony cleaning', price: 199 }, { name: 'Sofa vacuuming', price: 299 }],
    faqs: [{ q: 'Can I book a cleaning for a specific room only?', a: 'Yes. Tell us which rooms you want cleaned when you book and the professional will focus on those.' }, { q: 'Is the service suitable for homes with pets?', a: 'Yes. Let us know about your pets so the professional can use pet-safe products.' }],
    stars: [262, 36, 9, 3, 2],
  },
  {
    id: 's2', slug: 'plumbing', name: 'Plumbing', category: 'plumbing', price: 399, minutes: 90, rating: 4.8, ratingCount: 188, availability: 'today',
    description: 'Reliable plumbing services for common household plumbing requirements.', image: '/images/plumbing.jpg',
    included: ['Inspection of the problem', 'Leak and tap repairs', 'Basic fittings and tightening'],
    excluded: ['Spare parts and materials', 'Major pipe replacement'],
    addOns: [{ name: 'Water tank check', price: 149 }, { name: 'Extra tap or fixture', price: 199 }, { name: 'Drain unblocking', price: 299 }],
    faqs: [{ q: 'Do you handle emergency leaks?', a: 'Pick the earliest slot shown on the page. For urgent leaks, switch off the main water supply until the plumber arrives.' }, { q: 'Do you fix water-pressure problems?', a: 'Yes. The plumber will check taps, pipes and the tank outlet to find the cause.' }],
    stars: [155, 24, 6, 2, 1],
  },
  {
    id: 's3', slug: 'electrical-services', name: 'Electrical Services', category: 'electrical', price: 349, minutes: 90, rating: 4.7, ratingCount: 164, availability: 'tomorrow',
    description: 'Professional electrical services for safe and reliable home maintenance.', image: '/images/electrical.jpg',
    included: ['Fault finding', 'Switch, socket and fan repairs', 'Safety check after work'],
    excluded: ['New wiring runs', 'Spare parts and materials'],
    addOns: [{ name: 'Extra fan or light fitting', price: 149 }, { name: 'Switchboard check', price: 199 }, { name: 'MCB inspection', price: 249 }],
    faqs: [{ q: 'Can you fix a tripping circuit breaker?', a: 'Yes. The electrician will check the load and wiring to find why the breaker keeps tripping.' }, { q: 'Should I switch off the power before you arrive?', a: 'Please keep the area accessible. The electrician will switch off the supply before starting work.' }],
    stars: [125, 28, 7, 3, 1],
  },
  {
    id: 's4', slug: 'appliance-repair', name: 'Appliance Repair', category: 'appliance-repair', price: 499, minutes: 150, rating: 4.8, ratingCount: 142, availability: 'tomorrow',
    description: 'Expert appliance repair services for your everyday household appliances.', image: '/images/appliance-repair.jpg',
    included: ['Diagnosis of the fault', 'Repair of common issues', 'Test run after repair'],
    excluded: ['Replacement parts', 'Appliances out of warranty need a separate quote'],
    addOns: [{ name: 'Additional appliance check', price: 299 }, { name: 'Filter and vent cleaning', price: 249 }],
    faqs: [{ q: 'What if my appliance cannot be repaired?', a: 'The professional will tell you honestly, explain the options and charge only for the inspection.' }, { q: 'Do I need to keep the bill or warranty card ready?', a: 'It helps if the appliance is under warranty. Keep the bill handy for the visit.' }],
    stars: [117, 18, 5, 1, 1],
  },
  {
    id: 's5', slug: 'home-painting', name: 'Home Painting', category: 'painting', price: 999, minutes: 1440, rating: 4.7, ratingCount: 96, availability: 'scheduled',
    description: 'Give your home a fresh look with our professional home painting service.', image: '/images/painting.jpg',
    included: ['Surface preparation', 'Two coats of paint', 'Cleanup after work'],
    excluded: ['Paint and materials', 'Furniture moving beyond one room'],
    addOns: [{ name: 'Ceiling painting', price: 599 }, { name: 'Putty and primer coat', price: 799 }, { name: 'Furniture covering', price: 199 }],
    faqs: [{ q: 'Do I need to move my furniture before painting?', a: 'Please clear what you can. The team will cover and protect the remaining furniture and floors.' }, { q: 'How long before I can use the room again?', a: 'Most rooms are usable after 24 hours, depending on paint type and ventilation.' }],
    stars: [75, 14, 4, 2, 1],
  },
  {
    id: 's6', slug: 'home-maintenance', name: 'Home Maintenance', category: 'home-maintenance', price: 599, minutes: 150, rating: 4.8, ratingCount: 121, availability: 'today',
    description: 'Complete home maintenance services to keep your property in excellent condition.', image: '/images/home-maintenance.jpg',
    included: ['General inspection', 'Minor repairs and fittings', 'Cleanup after work'],
    excluded: ['Major structural work', 'Spare parts and materials'],
    addOns: [{ name: 'Extra room inspection', price: 199 }, { name: 'Door and hinge fixes', price: 249 }, { name: 'Curtain rod fitting', price: 149 }],
    faqs: [{ q: 'Can I get a regular maintenance visit?', a: 'Yes. Book this service again whenever you need, and mention your preferred day.' }, { q: 'Do you handle both indoor and outdoor fixes?', a: 'Mostly indoor fixes. Mention any outdoor work when booking and the team will confirm.' }],
    stars: [98, 16, 5, 1, 1],
  },
  {
    id: 's7', slug: 'deep-cleaning', name: 'Deep Cleaning', category: 'home-cleaning', price: 799, minutes: 210, rating: 4.9, ratingCount: 276, availability: 'today',
    description: 'Detailed deep cleaning service for a healthier and cleaner home.', image: '/images/deep-cleaning.jpg',
    included: ['Full-home scrubbing', 'Kitchen and bathroom descaling', 'Floor machine scrubbing'],
    excluded: ['Pest control', 'Interior cabinet cleaning'],
    addOns: [{ name: 'Sofa shampooing', price: 599 }, { name: 'Carpet cleaning', price: 499 }, { name: 'Window glass cleaning', price: 299 }],
    faqs: [{ q: 'Do I need to empty the house before deep cleaning?', a: 'No. Just put away valuables and fragile items. The team will clean around your furniture.' }, { q: 'How often should I book a deep clean?', a: 'Most homes benefit from a deep clean every 3 to 6 months.' }],
    stars: [246, 22, 5, 2, 1],
  },
  {
    id: 's8', slug: 'bathroom-cleaning', name: 'Bathroom Cleaning', category: 'home-cleaning', price: 399, minutes: 90, rating: 4.8, ratingCount: 203, availability: 'today',
    description: 'Professional bathroom cleaning service for a fresh and hygienic bathroom.', image: '/images/bathroom-cleaning.jpg',
    included: ['Tile and floor scrubbing', 'Toilet, sink and fittings cleaning', 'Mirror and glass wiping'],
    excluded: ['Plumbing repairs', 'Permanent stain removal'],
    addOns: [{ name: 'Extra bathroom', price: 349 }, { name: 'Tile grout whitening', price: 249 }, { name: 'Exhaust fan cleaning', price: 149 }],
    faqs: [{ q: 'Will you remove old soap scum and stains?', a: 'Yes, regular build-up is removed. Very old stains may not come off completely.' }, { q: 'Is the bathroom usable right after cleaning?', a: 'Yes, once the floor is dry.' }],
    stars: [170, 24, 6, 2, 1],
  },
  {
    id: 's9', slug: 'kitchen-cleaning', name: 'Kitchen Cleaning', category: 'home-cleaning', price: 449, minutes: 90, rating: 4.8, ratingCount: 189, availability: 'today',
    description: 'Thorough kitchen cleaning service to keep your cooking space fresh and hygienic.', image: '/images/kitchen-cleaning.jpg',
    included: ['Counter and sink cleaning', 'Stove and hob degreasing', 'Tile and wall wiping'],
    excluded: ['Inside of refrigerator', 'Chimney filter deep cleaning'],
    addOns: [{ name: 'Chimney exterior wipe', price: 249 }, { name: 'Cabinet interior cleaning', price: 399 }, { name: 'Fridge exterior polish', price: 149 }],
    faqs: [{ q: 'Do you clean greasy walls and tiles?', a: 'Yes. Grease on tiles and walls around the stove and counters is part of the cleaning.' }, { q: 'Can you clean the inside of the refrigerator?', a: 'Not in this service. You can add it as an add-on on some services.' }],
    stars: [158, 23, 5, 2, 1],
  },
];

const base = (s: Seed) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  description: s.description,
  icon: '',
  category: ref(s.category),
  basePrice: s.price,
  durationMinutes: s.minutes,
  rating: s.rating,
  ratingCount: s.ratingCount,
  availability: s.availability,
  imageUrl: s.image,
});

export const mockServiceDetails: ServiceDetail[] = seeds.map((s) => {
  const stem = s.image.replace('.jpg', '');
  const today = new Date();
  const next = new Date(today.getTime() + (s.availability === 'tomorrow' ? 1 : 0) * 86_400_000);
  return {
    ...base(s),
    media: [s.image, `${stem}-2.jpg`, `${stem}-3.jpg`, `${stem}-4.jpg`].map((url, i) => ({ url, alt: `${s.name} photo ${i + 1}` })),
    inclusions: s.included,
    exclusions: s.excluded,
    addOns: s.addOns.map((a, i) => ({ id: `${s.id}-ao${i + 1}`, ...a })),
    faqs: s.faqs.map((f, i) => ({ id: `${s.id}-f${i + 1}`, question: f.q, answer: f.a })),
    slotAvailability: {
      windowDays: 7,
      hasSlots: true,
      nextAvailableDate: s.availability === 'scheduled' ? null : next.toISOString().slice(0, 10),
    },
  } as ServiceDetail;
});

/** List items are the detail records without the detail-only fields. */
export const mockServices = mockServiceDetails.map(
  ({ media, inclusions, exclusions, addOns, faqs, slotAvailability, ...item }) => item,
);

/* -------------------------------- reviews -------------------------------- */

const reviewTemplates: Review[] = [
  { id: 'r1', rating: 5, comment: 'On time, polite and did a very neat job. Would book again.', author: 'Ananya R.', verified: true, createdAt: '2026-09-22T10:00:00Z' },
  { id: 'r2', rating: 5, comment: 'Good value for the price and the booking process was simple.', author: 'Suresh K.', verified: true, createdAt: '2026-09-05T09:30:00Z' },
  { id: 'r3', rating: 4, comment: 'Work quality was great. The professional arrived a little late.', author: 'Divya M.', verified: true, createdAt: '2026-08-30T14:00:00Z' },
  { id: 'r4', rating: 5, comment: 'Very professional team. The place looked brand new afterwards.', author: 'Rahul V.', verified: false, createdAt: '2026-08-18T11:15:00Z' },
  { id: 'r5', rating: 4, comment: 'Happy with the service, will recommend to friends.', author: 'Meera S.', verified: true, createdAt: '2026-08-02T16:45:00Z' },
];

export function mockReviewsFor(serviceId: string, page = 1, limit = 10): ReviewsPage {
  const seed = seeds.find((s) => s.id === serviceId);
  const [five, four, three, two, one] = seed?.stars ?? [0, 0, 0, 0, 0];
  const count = five + four + three + two + one;
  const all = seed ? reviewTemplates.map((r) => ({ ...r, id: `${serviceId}-${r.id}` })) : [];
  const start = (page - 1) * limit;
  return {
    summary: {
      average: seed?.rating ?? 0,
      count,
      distribution: { '5': five, '4': four, '3': three, '2': two, '1': one },
    },
    reviews: all.slice(start, start + limit),
    meta: { page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) },
  };
}

/* -------------------------------- banners -------------------------------- */

const banner = (id: string, category: string, title: string, description: string, image: string, alt: string): Banner => ({
  id, category, title, description, image, alt, link: '/services',
});

export const mockBanners: Banner[] = [
  banner('BANNER001', 'Home maintenance', 'Quality home services, from people you can trust', 'Find reliable professionals for your everyday home service needs.', '/images/home-maintenance.jpg', 'Technician carrying out home maintenance work'),
  banner('BANNER002', 'Home cleaning', 'A cleaner home, booked in minutes', 'Choose a service, pick a convenient slot, and we take care of the rest.', '/images/home-cleaning.jpg', 'Professional cleaning a living room'),
  banner('BANNER003', 'Plumbing', 'Leaks and blockages fixed right the first time', 'Experienced plumbers for repairs, fittings and emergency callouts.', '/images/plumbing.jpg', 'Plumber repairing a pipe'),
  banner('BANNER004', 'Electrical', 'Safe, certified electrical work at home', 'From a single switch to full rewiring, book a qualified electrician.', '/images/electrical.jpg', 'Electrician working on a wiring panel'),
  banner('BANNER005', 'Painting', 'Give your walls a fresh, clean finish', 'Skilled painters for interiors and exteriors, with minimal mess.', '/images/painting.jpg', 'Painter painting a wall'),
  banner('BANNER006', 'Appliance repair', 'Appliance repair at your doorstep', 'Get your washing machine, fridge or AC working again without the hassle.', '/images/appliance-repair.jpg', 'Technician repairing a home appliance'),
];
