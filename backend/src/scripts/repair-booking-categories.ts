/**
 * Repairs missing categoryId (and serviceId if missing) on Booking documents.
 * Safe to re-run: idempotent, skips bookings that already have categoryId.
 *   npx ts-node --transpile-only src/scripts/repair-booking-categories.ts
 */
import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { BookingModel } from '../models/Booking';
import { ServiceModel } from '../models/Service';
import { CategoryModel } from '../models/Category';

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');

  await mongoose.connect(url);

  const bookingsWithoutCategory = await BookingModel.find({
    $or: [{ categoryId: { $exists: false } }, { categoryId: null }],
  }).select('_id serviceId serviceName categoryId customerName').lean();

  console.log(`Found ${bookingsWithoutCategory.length} bookings without categoryId.`);

  if (bookingsWithoutCategory.length === 0) {
    console.log('All bookings already have categoryId assigned.');
    await mongoose.disconnect();
    return;
  }

  // Pre-load categories and services for fast lookup
  const [categories, services] = await Promise.all([
    CategoryModel.find({ active: true }).lean(),
    ServiceModel.find({}).lean(),
  ]);

  const defaultCategory = categories[0]?._id;

  let repairedCount = 0;
  for (const b of bookingsWithoutCategory) {
    let targetCategoryId: Types.ObjectId | null = null;
    let targetServiceId: Types.ObjectId | null = null;

    if (b.serviceId) {
      const match = services.find((s) => String(s._id) === String(b.serviceId));
      if (match?.categoryId) {
        targetCategoryId = match.categoryId as unknown as Types.ObjectId;
        targetServiceId = match._id as unknown as Types.ObjectId;
      }
    }

    if (!targetCategoryId && b.serviceName) {
      const cleanName = b.serviceName.trim().toLowerCase();
      const match = services.find(
        (s) => s.name.trim().toLowerCase() === cleanName || s.slug === cleanName.replace(/[^a-z0-9]+/g, '-'),
      );
      if (match?.categoryId) {
        targetCategoryId = match.categoryId as unknown as Types.ObjectId;
        targetServiceId = match._id as unknown as Types.ObjectId;
      }
    }

    if (!targetCategoryId && b.serviceName) {
      const cleanName = b.serviceName.trim().toLowerCase();
      const catMatch = categories.find(
        (c) => c.name.trim().toLowerCase() === cleanName || c.slug === cleanName.replace(/[^a-z0-9]+/g, '-'),
      );
      if (catMatch?._id) {
        targetCategoryId = catMatch._id as unknown as Types.ObjectId;
      }
    }

    if (!targetCategoryId && defaultCategory) {
      targetCategoryId = defaultCategory as unknown as Types.ObjectId;
    }

    if (targetCategoryId) {
      const updateDoc: Record<string, unknown> = { categoryId: targetCategoryId };
      if (targetServiceId && !b.serviceId) {
        updateDoc.serviceId = targetServiceId;
      }
      await BookingModel.updateOne({ _id: b._id }, { $set: updateDoc });
      repairedCount++;
      console.log(`  [Repaired] Booking ${b._id} ("${b.serviceName}") -> Category ${targetCategoryId}`);
    } else {
      console.warn(`  [Skipped] Booking ${b._id} ("${b.serviceName}") could not be resolved to any category.`);
    }
  }

  console.log(`\nSuccessfully repaired ${repairedCount} of ${bookingsWithoutCategory.length} bookings.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
