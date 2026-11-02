import { Types } from 'mongoose';
import { CategoryModel } from '../../models/Category';
import { ServiceModel } from '../../models/Service';
import { HttpError } from '../auth/auth.types';
import { slugify, uniqueSlug } from '../../utils/slug';
import { DEFAULT_CATEGORY_MEDIA, SEED_CATEGORIES } from './categories.constants';
import { categoryCreateSchema, categoryReorderSchema, categoryUpdateSchema } from './categories.validation';
import type { CategoryDto } from './categories.types';

const CI = {
  collation: { locale: 'en', strength: 2 },
} as const;

const toDto = (
  c: InstanceType<typeof CategoryModel>,
  services = 0,
): CategoryDto => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description ?? '',
  icon: c.icon ?? '',
  sortOrder: c.sortOrder ?? 0,
  active: c.active,
  services,
  iconUrl: c.iconUrl ?? '',
  parentId: c.parentId ? String(c.parentId) : null,
  images: (c.images ?? []).map((i) => ({ url: i.url, alt: i.alt ?? '', isPrimary: !!i.isPrimary })),
  createdAt: (c as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? '',
  updatedAt: (c as unknown as { updatedAt?: Date }).updatedAt?.toISOString() ?? '',
});

/** Only two levels: a parent must be top-level, and a category with children cannot become a child. */
async function assertParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (selfId && parentId === selfId) throw new HttpError(400, 'A category cannot be its own parent', 'DEPTH');
  const parent = await CategoryModel.findById(parentId, 'parentId');
  if (!parent) throw new HttpError(404, 'Parent category not found', 'NOT_FOUND');
  if (parent.parentId) throw new HttpError(400, 'Only two levels are supported: a sub-category cannot have children', 'DEPTH');
  if (selfId && (await CategoryModel.exists({ parentId: selfId }))) {
    throw new HttpError(400, 'This category has sub-categories, so it cannot become one', 'DEPTH');
  }
}

/** Exactly one primary image (the first when none is flagged). */
const normaliseImages = <T extends { isPrimary: boolean }>(images?: T[]) =>
  images?.map((img, i) => ({ ...img, isPrimary: images.some((x) => x.isPrimary) ? img.isPrimary && images.findIndex((x) => x.isPrimary) === i : i === 0 }));

/**
 * Inserts missing default categories.
 *
 * Also removes old/incomplete category records that do not have
 * a valid name. This prevents blank categories from appearing
 * in the admin Coupon form.
 *
 * Existing valid categories are preserved.
 */
export async function seedDefaultCategories() {
  // Remove only incomplete/blank category records.
  await CategoryModel.deleteMany({
    $or: [
      { name: { $exists: false } },
      { name: null },
      { name: '' },
    ],
  });

  // Insert any missing default categories.
  for (const [index, category] of SEED_CATEGORIES.entries()) {
    const existing = await CategoryModel.findOne({
      $or: [
        { _id: category.id },
        { slug: category.slug },
        { name: category.name },
      ],
    });

    if (existing) {
      continue;
    }

    const media = DEFAULT_CATEGORY_MEDIA[category.slug];

    await CategoryModel.create({
      _id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      sortOrder: index,
      active: true,
      ...(media
        ? {
            iconUrl: media.iconUrl,
            images: [{ url: media.image, alt: category.name, isPrimary: true }],
          }
        : {}),
    });
  }
}

export const categoriesService = {
  /**
   * Admin: every category with its service count.
   * Public: only active categories.
   */
  async list({ onlyActive = false } = {}): Promise<CategoryDto[]> {
    const [rows, counts] = await Promise.all([
      CategoryModel.find(
        onlyActive ? { active: true } : {},
      )
        .sort({ sortOrder: 1, name: 1 })
        .collation({ locale: 'en' }),

      ServiceModel.aggregate<{
        _id: unknown;
        n: number;
      }>([
        {
          $match: onlyActive ? { active: true } : {},
        },
        {
          $group: {
            _id: '$categoryId',
            n: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byId = new Map(
      counts.map((c) => [String(c._id), c.n]),
    );

    return rows.map((c) =>
      toDto(c, byId.get(c.id) ?? 0),
    );
  },

  async create(input: unknown) {
    const data = categoryCreateSchema.parse(input);

    if (
      await CategoryModel.exists({
        name: data.name,
      }).collation(CI.collation)
    ) {
      throw new HttpError(
        409,
        `“${data.name}” already exists`,
        'DUPLICATE_CATEGORY',
      );
    }

    const slug = await uniqueSlug(
      slugify(data.name),
      (s) =>
        CategoryModel.exists({
          slug: s,
        }).then(Boolean),
    );

    await assertParent(data.parentId);

    return toDto(
      await CategoryModel.create({
        ...data,
        images: normaliseImages(data.images),
        slug,
      }),
    );
  },

  async update(id: string, input: unknown) {
    const data = categoryUpdateSchema.parse(input);

    const existing = await CategoryModel.findById(id);

    if (!existing) {
      throw new HttpError(
        404,
        'Category not found',
        'NOT_FOUND',
      );
    }

    if (
      data.name &&
      data.name !== existing.name
    ) {
      if (
        await CategoryModel.exists({
          name: data.name,
          _id: { $ne: id },
        }).collation(CI.collation)
      ) {
        throw new HttpError(
          409,
          `“${data.name}” already exists`,
          'DUPLICATE_CATEGORY',
        );
      }
    }

    if (data.parentId !== undefined) await assertParent(data.parentId, id);

    // Keep the existing slug stable so existing links continue working.
    existing.set({ ...data, ...(data.images ? { images: normaliseImages(data.images) } : {}) });

    await existing.save();

    return toDto(
      existing,
      await ServiceModel.countDocuments({
        categoryId: existing._id,
      }),
    );
  },

  /**
   * Saves a whole new order in one atomic-ish bulk write,
   * so the public site never sees a half-applied order.
   */
  async reorder(input: unknown): Promise<CategoryDto[]> {
    const { items } = categoryReorderSchema.parse(input);

    const found = await CategoryModel.countDocuments({
      _id: { $in: items.map((i) => i.id) },
    });

    if (found !== items.length) {
      throw new HttpError(
        404,
        'One or more categories were not found',
        'NOT_FOUND',
      );
    }

    await CategoryModel.bulkWrite(
      items.map((i) => ({
        updateOne: {
          filter: { _id: i.id },
          update: {
            $set: {
              sortOrder: i.sortOrder,
              ...(i.parentId !== undefined ? { parentId: i.parentId ? new Types.ObjectId(i.parentId) : null } : {}),
            },
          },
        },
      })),
    );

    return this.list();
  },

  /**
   * Block deletion while services still belong to the category.
   * Move or delete those services first, or deactivate the category.
   */
  async remove(id: string) {
    const existing = await CategoryModel.findById(id);

    if (!existing) {
      throw new HttpError(
        404,
        'Category not found',
        'NOT_FOUND',
      );
    }

    const inUse = await ServiceModel.countDocuments({
      categoryId: existing._id,
    });

    if (inUse > 0) {
      throw new HttpError(
        409,
        `${inUse} service${
          inUse === 1 ? ' is' : 's are'
        } still in “${existing.name}”. Move or delete them first, or deactivate the category.`,
        'CATEGORY_IN_USE',
      );
    }

    await existing.deleteOne();
  },
};
