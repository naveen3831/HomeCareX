import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { HttpError } from '../auth/auth.types';
import { primaryImageUrl } from '../categories/categories.media';
import { summarizeAvailability } from './catalog.availability';
import { buildServiceQuery } from './catalog.query';
import { catalogRepository as repo, type CategoryRow, type ServiceRow } from './catalog.repository';
import type { PageMeta, PublicCategoryDto, PublicServiceDetailDto, PublicServiceDto } from './catalog.types';
import { categoryQuerySchema, serviceParamSchema, serviceQuerySchema } from './catalog.validation';

type CategoryLite = PublicServiceDto['category'];

const toCategoryLite = (c: CategoryRow): CategoryLite => ({ id: String(c._id), name: c.name, slug: c.slug });

const toService = (s: ServiceRow, cat: CategoryLite): PublicServiceDto => ({
  id: String(s._id),
  slug: s.slug,
  name: s.name,
  description: s.description ?? '',
  icon: s.icon ?? '',
  ...(s.iconUrl ? { iconUrl: s.iconUrl } : {}),
  ...(s.media?.[0]?.url ? { image: s.media[0].url } : {}),
  category: cat,
  basePrice: s.basePrice,
  durationMinutes: s.durationMinutes,
  rating: s.ratingAvg ?? 0,
  ratingCount: s.ratingCount ?? 0,
  availability: s.availability ?? 'scheduled',
});

export const catalogService = {
  /** Active categories in admin-defined order, each with its number of active services. */
  async listCategories(query: unknown): Promise<PublicCategoryDto[]> {
    categoryQuerySchema.parse(query);
    const [cats, stats] = await Promise.all([repo.activeCategories(true), repo.activeServiceStats()]);
    const top = Math.max(0, ...[...stats.values()].map((x) => x.bookings));
    // Exactly one category is "popular": the first with the highest bookings (none while nothing is booked yet).
    const popularId = top > 0 ? cats.find((c) => stats.get(String(c._id))?.bookings === top)?._id : undefined;
    const seenCategoryIds = new Set<string>();
    const result: PublicCategoryDto[] = [];
    for (const c of cats) {
      if (/test/i.test(c.slug) || /test/i.test(c.name)) continue;
      const id = String(c._id);
      if (seenCategoryIds.has(id)) continue;
      seenCategoryIds.add(id);
      result.push({
        id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? '',
        icon: c.icon ?? '',
        iconUrl: c.iconUrl ?? '',
        imageUrl: primaryImageUrl(c.images),
        sortOrder: c.sortOrder ?? 0,
        serviceCount: stats.get(id)?.count ?? 0,
        fromPrice: stats.get(id)?.fromPrice ?? 0,
        popular: popularId !== undefined && String(popularId) === id,
      });
    }
    return result;
  },

  /** Validated, filtered, sorted, paginated. A page past the end returns an empty list, not an error. */
  async searchServices(query: unknown): Promise<{ items: PublicServiceDto[]; meta: PageMeta }> {
    const parsed = serviceQuerySchema.parse(query);
    const { page, limit } = parsed;

    const cats = await repo.activeCategories();
    let scope = cats;
    if (parsed.category) {
      const catKey = parsed.category.toLowerCase().trim();
      scope = cats.filter((c) => {
        const idStr = String(c._id).toLowerCase();
        const slug = (c.slug || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        if (idStr === catKey || slug === catKey || name === catKey) return true;

        const isAppliance = (s: string) =>
          s === 'appliance-repair' || s === 'appliance-repair-service' || s === 'appliance' || s === 'appliances' || s.includes('appliance');
        if (isAppliance(catKey) && (isAppliance(slug) || isAppliance(name))) return true;

        const isCleaning = (s: string) =>
          s === 'cleaning' || s === 'home-cleaning' || s === 'deep-cleaning' || s.includes('clean');
        if (isCleaning(catKey) && (isCleaning(slug) || isCleaning(name))) return true;

        const isPlumbingOrElectrical = (s: string) =>
          s === 'plumbing' || s === 'electrical' || s === 'electrical-plumbing' || s === 'plumbing-electrical' || s.includes('plumb') || s.includes('electr');
        if (isPlumbingOrElectrical(catKey) && (isPlumbingOrElectrical(slug) || isPlumbingOrElectrical(name))) return true;

        const isPainting = (s: string) =>
          s === 'painting' || s === 'waterproofing' || s === 'painting-waterproofing' || s.includes('paint');
        if (isPainting(catKey) && (isPainting(slug) || isPainting(name))) return true;

        const isPest = (s: string) =>
          s === 'pest' || s === 'pest-control' || s.includes('pest');
        if (isPest(catKey) && (isPest(slug) || isPest(name))) return true;

        const isSalon = (s: string) =>
          s === 'salon' || s === 'spa' || s === 'salon-spa' || s.includes('salon') || s.includes('spa');
        if (isSalon(catKey) && (isSalon(slug) || isSalon(name))) return true;

        const isCarpentry = (s: string) =>
          s === 'carpentry' || s === 'furniture-assembly' || s === 'carpentry-furniture-assembly' || s.includes('carpent');
        if (isCarpentry(catKey) && (isCarpentry(slug) || isCarpentry(name))) return true;

        return false;
      });
    }
    const emptyMeta: PageMeta = { page, limit, total: 0, totalPages: 0 };
    if (scope.length === 0) return { items: [], meta: emptyMeta };

    const categoryScope = scope.map((c) => new Types.ObjectId(String(c._id)));
    const built = buildServiceQuery(parsed, categoryScope);
    const [rows, total] = await Promise.all([repo.findServices(built, (page - 1) * limit, limit), repo.countServices(built)]);

    const byId = new Map(cats.map((c) => [String(c._id), toCategoryLite(c)]));
    const seenServiceIds = new Set<string>();
    const items: PublicServiceDto[] = [];
    for (const r of rows) {
      const id = String(r._id);
      if (seenServiceIds.has(id)) continue;
      seenServiceIds.add(id);
      const cat = byId.get(String(r.categoryId)) ?? (scope.length > 0 ? toCategoryLite(scope[0]) : undefined);
      if (cat) {
        items.push(toService(r, cat));
      }
    }
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getService(params: unknown): Promise<PublicServiceDetailDto> {
    const { idOrSlug } = serviceParamSchema.parse(params);
    const row = await repo.findService(idOrSlug);
    const cat = row && (await repo.activeCategories()).find((c) => String(c._id) === String(row.categoryId));
    if (!row || !cat) throw new HttpError(404, 'Service not found', ERROR_CODES.NOT_FOUND);
    // Only for services that exist and are active, so 404s never touch the slot service.
    const slotAvailability = await summarizeAvailability(String(row._id));
    return {
      ...toService(row, toCategoryLite(cat)),
      media: (row.media ?? []).map((m) => ({ url: m.url, alt: m.alt ?? '' })),
      inclusions: row.inclusions ?? [],
      exclusions: row.exclusions ?? [],
      addOns: (row.addOns ?? []).map((a) => ({ id: String(a._id), name: a.name, price: a.price })),
      faqs: (row.faqs ?? []).map((f) => ({ id: String(f._id), question: f.question, answer: f.answer })),
      slotAvailability,
    };
  },
};
