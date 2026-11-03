import { Types } from 'mongoose';
import { ERROR_CODES } from '../../constants/errorCodes';
import { HttpError } from '../auth/auth.types';
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
  iconUrl: s.iconUrl ?? '',
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
    const [cats, stats] = await Promise.all([repo.activeCategories(), repo.activeServiceStats()]);
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
        image: c.images?.find((i) => i.isPrimary)?.url || c.images?.[0]?.url || '',
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
      const catKey = parsed.category.toLowerCase();
      scope = cats.filter((c) => {
        const idStr = String(c._id);
        const slug = c.slug.toLowerCase();
        if (idStr === catKey || slug === catKey) return true;
        if ((catKey === 'plumbing' || catKey === 'electrical') && slug === 'electrical-plumbing') return true;
        if (catKey === 'appliance-repair' && slug === 'appliance-repair-service') return true;
        if (catKey === 'cleaning' && slug === 'home-cleaning') return true;
        return false;
      });
    }
    const emptyMeta: PageMeta = { page, limit, total: 0, totalPages: 0 };
    if (scope.length === 0) return { items: [], meta: emptyMeta };

    const categoryScope = parsed.category ? scope.map((c) => new Types.ObjectId(String(c._id))) : undefined;
    const built = buildServiceQuery(parsed, categoryScope);
    const [rows, total] = await Promise.all([repo.findServices(built, (page - 1) * limit, limit), repo.countServices(built)]);

    const byId = new Map(cats.map((c) => [String(c._id), toCategoryLite(c)]));
    const seenServiceIds = new Set<string>();
    const items: PublicServiceDto[] = [];
    for (const r of rows) {
      if (/test/i.test(r.slug) || /test/i.test(r.name)) continue;
      const id = String(r._id);
      if (seenServiceIds.has(id)) continue;
      seenServiceIds.add(id);
      const cat = byId.get(String(r.categoryId));
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
