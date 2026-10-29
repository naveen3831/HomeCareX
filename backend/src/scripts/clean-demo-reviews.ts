/**
 * Removes the demo data that the seed scripts put on the service pages, and fixes the rating numbers.
 *
 *   npm run clean:demo-reviews --workspace=backend            -> DRY RUN: lists what would change, changes nothing
 *   npm run clean:demo-reviews --workspace=backend -- --apply -> deletes and recomputes
 *
 * What counts as demo data: a review attached to a service or a partner that has NO bookingId.
 * Every real review is created from a completed booking (POST /bookings/:id/review) and always has a
 * bookingId, so real reviews are never touched. Site-wide testimonials (no service, no partner) are
 * left alone too.
 *
 * Why the rating numbers need fixing as well: the catalog seed writes fixed ratingAvg / ratingCount values
 * onto each Service (for example 4.7 from 180 reviews). Those were never calculated from reviews, so deleting
 * the fake reviews alone would leave them. After deleting, every service (and each affected partner) is
 * recomputed from the reviews that remain, using the same functions the app uses after a real review.
 *
 * Do NOT run `npm run seed:catalog` or `npm run seed` again afterwards: the catalog seed puts the fake
 * rating numbers back on any service whose ratingCount is 0.
 *
 * Dev / staging only.
 */
import dotenv from 'dotenv';
import mongoose, { type FilterQuery } from 'mongoose';
import { ReviewModel, type Review } from '../models/Review';
import { ServiceModel } from '../models/Service';
import { reviewsRepository } from '../modules/reviews/reviews.repository';

dotenv.config();

/** Reviews that belong to a service or partner but not to a booking (`null` matches a missing or null bookingId). */
const DEMO_REVIEW_FILTER: FilterQuery<Review> = {
  bookingId: null,
  $or: [{ serviceId: { $ne: null } }, { partnerId: { $ne: null } }],
};

const clip = (s: string | undefined, n = 60) => ((s ?? '').length > n ? `${(s ?? '').slice(0, n)}…` : s ?? '');

async function main() {
  const apply = process.argv.includes('--apply');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to delete reviews in production.');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');
  await mongoose.connect(url);

  const demo = await ReviewModel.find(DEMO_REVIEW_FILTER, 'customerName rating status message serviceId partnerId').lean();
  const realCount = await ReviewModel.countDocuments({ bookingId: { $ne: null } });
  const serviceNames = new Map(
    (await ServiceModel.find({}, 'name').lean()).map((s) => [String(s._id), s.name as string]),
  );

  console.log(`\nDemo reviews found: ${demo.length}   Real reviews (from bookings) kept: ${realCount}\n`);
  console.table(
    demo.map((r) => ({
      service: r.serviceId ? serviceNames.get(String(r.serviceId)) ?? String(r.serviceId) : '(none)',
      by: r.customerName,
      rating: r.rating,
      status: r.status,
      message: clip(r.message),
    })),
  );

  if (!apply) {
    console.log('Dry run only. Nothing was changed. Run again with --apply to delete these and recompute ratings.');
    await mongoose.disconnect();
    return;
  }

  const partnerIds = [...new Set(demo.filter((r) => r.partnerId).map((r) => String(r.partnerId)))];
  const { deletedCount } = await ReviewModel.deleteMany({ _id: { $in: demo.map((r) => r._id) } });
  console.log(`Deleted ${deletedCount} demo review(s).`);

  // Every service, not only the ones that had demo reviews: the fake 4.7 / 180 lives on the service itself.
  const services = await ServiceModel.find({}, '_id name ratingAvg ratingCount').lean();
  for (const s of services) {
    const before = `${s.ratingAvg ?? 0} (${s.ratingCount ?? 0})`;
    const { ratingAvg, ratingCount } = await reviewsRepository.recomputeServiceRating(String(s._id));
    const after = `${ratingAvg} (${ratingCount})`;
    if (before !== after) console.log(`  ${s.name}: ${before} -> ${after}`);
  }
  for (const id of partnerIds) {
    const { ratingAvg, ratingCount } = await reviewsRepository.recomputePartnerRating(id);
    console.log(`  partner ${id}: now ${ratingAvg} from ${ratingCount} review(s)`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
