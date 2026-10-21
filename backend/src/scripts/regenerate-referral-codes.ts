/**
 * One-off: give existing customers the name-based referral code (HCX + first name).
 * Dry run by default. Run with --apply to write. NOTE: this replaces a customer's old code, so any old
 * code they already shared stops working. Run it only if the team accepts that.
 *   npx ts-node src/scripts/regenerate-referral-codes.ts [--apply]
 */
import mongoose from "mongoose";
import { ReferralCodeModel } from "../modules/referrals/referrals.model";
import { referralCodeCandidate } from "../modules/referrals/referrals.service";
import { UserModel } from "../models/User";

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL.");
  await mongoose.connect(url);
  await ReferralCodeModel.init();
  let changed = 0;
  for (const row of await ReferralCodeModel.find({})) {
    const user = await UserModel.findById(row.referrerId)
      .select("name")
      .lean<{ name?: string | null }>();
    for (let attempt = 0; attempt < 8; attempt++) {
      const next = referralCodeCandidate(user?.name, attempt);
      if (next === row.code) break;
      if (!apply) {
        console.log(`[dry run] ${row.code} -> ${next}`);
        changed++;
        break;
      }
      try {
        await ReferralCodeModel.updateOne(
          { _id: row._id },
          { $set: { code: next } },
        );
        console.log(`${row.code} -> ${next}`);
        changed++;
        break;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
  }
  console.log(`${apply ? "Updated" : "Would update"} ${changed} code(s).`);
  await mongoose.disconnect();
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
