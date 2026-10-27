import { z } from 'zod';

const imageSchema = z.object({
  url: z.string().trim().min(1).max(300_000),
  alt: z.string().trim().max(160).default(''),
  isPrimary: z.boolean().default(false),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be 60 characters or fewer'),
  description: z.string().trim().max(240).optional(),
  icon: z.string().trim().max(8).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
  iconUrl: z.string().trim().max(300_000).optional(),
  parentId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid parent id').nullable().optional(),
  images: z.array(imageSchema).max(10).optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Nothing to update',
});

/** Bulk reorder: every item carries the final sortOrder; ids must be unique. */
export const categoryReorderSchema = z.object({
  items: z
    .array(z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0).max(9999),
        parentId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
      }))
    .min(1)
    .max(500)
    .refine((a) => new Set(a.map((i) => i.id)).size === a.length, { message: 'Duplicate ids in reorder request' }),
});

export const categoriesValidation = { categoryCreateSchema, categoryUpdateSchema, categoryReorderSchema };