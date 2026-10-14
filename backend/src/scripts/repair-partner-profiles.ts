/**
 * Repairs missing Partner documents for users with role="partner".
 * Safe to re-run: idempotent upsert, never overwrites existing partner profiles.
 *   npx ts-node --transpile-only src/scripts/repair-partner-profiles.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { ensurePartnerProfile } from '../modules/partners/partners.service';

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');

  await mongoose.connect(url);

  const partnerUsers = await UserModel.find({ role: 'partner' }).select('_id name email role').lean();
  console.log(`Found ${partnerUsers.length} partner user accounts.`);

  let repaired = 0;
  for (const user of partnerUsers) {
    const profile = await ensurePartnerProfile(user._id);
    if (profile) {
      repaired++;
      console.log(`  [OK] Profile confirmed/repaired for ${user.email} (${user._id}) -> partner ${profile._id}`);
    }
  }

  console.log(`\nCompleted repair for ${repaired} partner profiles.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
