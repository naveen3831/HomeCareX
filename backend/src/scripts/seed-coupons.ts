import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CouponModel } from '../models/Coupon';

dotenv.config();

const SEED_COUPONS = [
  {
    code: 'WELCOME10',
    type: 'PERCENT' as const,
    value: 10,
    maxDiscount: 300,
    minOrder: 0,
    totalLimit: 1000,
    perUserLimit: 10,
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
    perUserLimit: 10,
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
    perUserLimit: 10,
    categoryIds: [],
    active: true,
  },
  {
    code: 'HOMECARE50',
    type: 'FLAT' as const,
    value: 50,
    maxDiscount: null,
    minOrder: 199,
    totalLimit: 1000,
    perUserLimit: 20,
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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  await mongoose.connect(url);
  console.log('Connected to MongoDB');

  const now = new Date();
  const startAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const defaultEndAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const endAt = defaultEndAt;

  for (const c of SEED_COUPONS) {
    const existing = await CouponModel.findOne({ code: c.code });
    if (!existing) {
      await CouponModel.create({
        ...c,
        startAt,
        endAt,
      });
      console.log(`Created coupon: ${c.code}`);
    } else {
      await CouponModel.findByIdAndUpdate(existing._id, {
        $set: {
          active: true,
          startAt,
          endAt,
          minOrder: c.minOrder,
          value: c.value,
          type: c.type,
          maxDiscount: c.maxDiscount,
          totalLimit: c.totalLimit,
          perUserLimit: c.perUserLimit,
        },
      });
      console.log(`Updated coupon: ${c.code}`);
    }
  }

  const allCoupons = await CouponModel.find({ active: true });
  console.log(`Total active coupons in DB: ${allCoupons.length}`);

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
