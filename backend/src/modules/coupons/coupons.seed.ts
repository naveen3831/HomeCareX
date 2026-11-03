import { CouponModel } from '../../models/Coupon';
import { CategoryModel } from '../../models/Category';

export const SEED_COUPONS = [
  {
    code: 'WELCOME10',
    type: 'PERCENT' as const,
    value: 10,
    maxDiscount: 300,
    minOrder: 0,
    totalLimit: 1000,
    perUserLimit: 3,
    categoryIds: [],
    active: true,
  },
  {
    code: 'SAVE100',
    type: 'FLAT' as const,
    value: 100,
    maxDiscount: null,
    minOrder: 499,
    totalLimit: 500,
    perUserLimit: 2,
    categoryIds: [],
    active: true,
  },
  {
    code: 'SPA20',
    type: 'PERCENT' as const,
    value: 20,
    maxDiscount: 300,
    minOrder: 499,
    totalLimit: 500,
    perUserLimit: 2,
    categorySlug: 'salon-spa',
    categoryIds: [],
    active: true,
  },
  {
    code: 'CLEAN100',
    type: 'FLAT' as const,
    value: 100,
    maxDiscount: null,
    minOrder: 999,
    totalLimit: 500,
    perUserLimit: 2,
    categorySlug: 'home-cleaning',
    categoryIds: [],
    active: true,
  },
  {
    code: 'FLAT200',
    type: 'FLAT' as const,
    value: 200,
    maxDiscount: null,
    minOrder: 999,
    totalLimit: 500,
    perUserLimit: 1,
    categoryIds: [],
    active: true,
  },
  {
    code: 'FESTIVE20',
    type: 'PERCENT' as const,
    value: 20,
    maxDiscount: 500,
    minOrder: 799,
    totalLimit: 200,
    perUserLimit: 1,
    categoryIds: [],
    active: true,
  },
];

export async function seedDefaultCoupons(): Promise<number> {
  const count = await CouponModel.countDocuments();
  if (count > 0) return 0;

  const now = new Date();
  const startAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  let inserted = 0;

  for (const c of SEED_COUPONS) {
    let categoryIds: unknown[] = [];
    if ('categorySlug' in c && c.categorySlug) {
      const cat = await CategoryModel.findOne({ slug: c.categorySlug });
      if (cat) {
        categoryIds = [cat._id];
      }
    }

    const { categorySlug: _, ...couponData } = c as any;

    await CouponModel.create({
      ...couponData,
      categoryIds,
      startAt,
      endAt,
    });
    inserted++;
  }

  return inserted;
}
