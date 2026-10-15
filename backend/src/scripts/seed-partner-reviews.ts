/**
 * Seeds demo reviews for the test partner (partner@homecarex.com) so GET /partner/reviews and /summary have data.
 * Safe to re-run: each review is upserted by (partner, customer, message).
 *   npx ts-node --transpile-only src/scripts/seed-partner-reviews.ts      (run inside backend/)
 * Needs: seed:users (partner + customer) and seed:catalog (services) to have been run first.
 * Dev / staging only. Includes a hidden review and a rejected review that must NOT appear for the partner.
 *
 * Expected for this partner afterwards: 5 reviews counted (5, 5, 4, 4, 3), average 4.2,
 * distribution { 5: 2, 4: 2, 3: 1, 2: 0, 1: 0 }. The pending review counts (same rule as the Performance rating).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PartnerModel from '../models/Partner';
import ReviewModel from '../models/Review';
import { ServiceModel } from '../models/Service';
import { UserModel } from '../models/User';
import { reviewsRepository } from '../modules/reviews/reviews.repository';

dotenv.config();

const PARTNER_EMAIL = 'partner@homecarex.com';

type Status = 'approved' | 'pending' | 'rejected';
interface Demo {
  slug: string;
  name: string;
  rating: number;
  message: string;
  tags: string[];
  status: Status;
  visible: boolean;
  daysAgo: number;
}

const DEMO: Demo[] = [
  { slug: 'deep-home-cleaning', name: 'Ananya Rao', rating: 5, message: 'Arrived on time and the flat looked brand new. Kitchen and bathrooms were spotless.', tags: ['On time', 'Clean work'], status: 'approved', visible: true, daysAgo: 1 },
  { slug: 'ac-service-gas-refill', name: 'Sandeep Kumar', rating: 5, message: 'AC is cooling much better after the jet wash. Everything was explained clearly.', tags: ['Professional', 'Good quality'], status: 'approved', visible: true, daysAgo: 3 },
  { slug: 'deep-home-cleaning', name: 'Vikram Singh', rating: 4, message: 'Very thorough work overall. Balcony needed a little extra attention but it was fixed quickly.', tags: ['Good quality'], status: 'approved', visible: true, daysAgo: 6 },
  { slug: 'general-pest-control', name: 'Imran Shaikh', rating: 3, message: 'Good service but the visit started a little later than the slot I had picked.', tags: [], status: 'approved', visible: true, daysAgo: 12 },
  { slug: 'at-home-spa-for-women', name: 'Kavitha Reddy', rating: 4, message: 'Relaxing session and a friendly professional. Waiting for moderation, still counted for the partner.', tags: ['Professional'], status: 'pending', visible: true, daysAgo: 2 },
  { slug: 'deep-home-cleaning', name: 'Hidden Person', rating: 1, message: 'This review was hidden by an admin and must never show for the partner.', tags: [], status: 'approved', visible: false, daysAgo: 4 },
  { slug: 'mens-haircut-grooming', name: 'Rejected Person', rating: 1, message: 'This review was rejected by an admin and must never show for the partner.', tags: [], status: 'rejected', visible: true, daysAgo: 5 },
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo reviews in production.');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');
  await mongoose.connect(url);

  const partnerUser = await UserModel.findOne({ email: PARTNER_EMAIL }, '_id').lean();
  if (!partnerUser) throw new Error(`No user ${PARTNER_EMAIL}. Run: npm run seed:users`);
  const partner = await PartnerModel.findOne({ userId: partnerUser._id }, '_id').lean();
  if (!partner) throw new Error('That user has no partner profile. Run: npm run repair:partners');
  const customer = await UserModel.findOne({ role: 'customer' }, '_id email').lean();
  if (!customer) throw new Error('No customer user found. Run: npm run seed:users');

  const services = await ServiceModel.find({ slug: { $in: [...new Set(DEMO.map((d) => d.slug))] } }, '_id slug').lean();
  const idBySlug = new Map(services.map((s) => [s.slug, s._id]));

  let upserted = 0;
  for (const d of DEMO) {
    const serviceId = idBySlug.get(d.slug);
    if (!serviceId) {
      console.log(`  skipped ${d.slug} (service not found; run seed:catalog first)`);
      continue;
    }
    const createdAt = new Date(Date.now() - d.daysAgo * 24 * 60 * 60 * 1000);
    await ReviewModel.updateOne(
      { partnerId: partner._id, customerId: customer._id, message: d.message },
      {
        $setOnInsert: {
          customerName: d.name,
          customerEmail: customer.email,
          rating: d.rating,
          tags: d.tags,
          status: d.status,
          visible: d.visible,
          verified: true,
          serviceId,
          createdAt,
          updatedAt: createdAt,
        },
      },
      { upsert: true, timestamps: false },
    );
    upserted += 1;
  }
  const { ratingAvg, ratingCount } = await reviewsRepository.recomputePartnerRating(String(partner._id));
  console.log(`Seeded ${upserted} review(s) for ${PARTNER_EMAIL}. Partner rating is now ${ratingAvg} from ${ratingCount} review(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});