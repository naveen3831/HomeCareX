/**
 * Default look of each seeded category: the cover photo and the 3D icon the customer app and public site
 * already ship in the frontend's public folder. Once stored, the admin can replace both in Categories.
 */
export const DEFAULT_CATEGORY_MEDIA: Record<string, { image: string; iconUrl: string }> = {
  'home-cleaning': { image: '/images/home-cleaning.jpg', iconUrl: '/icons/3d/broom.png' },
  'appliance-repair-service': { image: '/images/appliance-repair.jpg', iconUrl: '/icons/3d/wrench.png' },
  'salon-spa': { image: '/images/Home-spa-women.png', iconUrl: '/icons/3d/massage.png' },
  'electrical-plumbing': { image: '/images/electrical.jpg', iconUrl: '/icons/3d/light-bulb.png' },
  'painting-waterproofing': { image: '/images/painting-category.png', iconUrl: '/icons/3d/palette.png' },
  'pest-control': { image: '/images/pest-control-clean.png', iconUrl: '/icons/3d/ant.png' },
  'carpentry-furniture-assembly': { image: '/images/home-maintenance.jpg', iconUrl: '/icons/3d/toolbox.png' },
};

/** Fixed ids so the seeded catalog lines up with the placeholder in bookings.constants.ts. */
export const SEED_CATEGORIES = [
  { id: '650000000000000000000a01', name: 'Home Cleaning', slug: 'home-cleaning', icon: '🧹', description: 'Deep cleaning, bathroom, kitchen, sofa & carpet shampooing' },
  { id: '650000000000000000000a02', name: 'Appliance Repair & Service', slug: 'appliance-repair-service', icon: '🔧', description: 'AC, washing machine, refrigerator, RO/water purifier' },
  { id: '650000000000000000000a03', name: 'Salon & Spa', slug: 'salon-spa', icon: '💆', description: 'At-home beauty, massage, and grooming for women & men' },
  { id: '650000000000000000000a04', name: 'Electrical & Plumbing', slug: 'electrical-plumbing', icon: '💡', description: 'Wiring, fixtures, leak repair, fittings' },
  { id: '650000000000000000000a05', name: 'Painting & Waterproofing', slug: 'painting-waterproofing', icon: '🎨', description: 'Interior/exterior painting, damp-proofing' },
  { id: '650000000000000000000a06', name: 'Pest Control', slug: 'pest-control', icon: '🐜', description: 'General pest, termite, and mosquito treatments' },
  { id: '650000000000000000000a07', name: 'Carpentry & Furniture Assembly', slug: 'carpentry-furniture-assembly', icon: '🪚', description: 'Furniture assembly, repairs, custom fittings' },
] as const;

export const CATEGORIES_CONSTANTS = { SEED_CATEGORIES };
