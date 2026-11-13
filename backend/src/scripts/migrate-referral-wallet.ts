import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { WalletModel, WalletLedgerModel } from '../models/Wallet';
import { ReferralModel } from '../modules/referrals/referrals.model';
import { BookingModel } from '../models/Booking';

export async function runMigration() {
  console.log('[Migration] Ensuring indexes on Wallet, WalletLedger, Referral, and Booking...');
  await Promise.all([
    WalletModel.init(),
    WalletLedgerModel.init(),
    ReferralModel.init(),
    BookingModel.init(),
  ]);

  console.log('[Migration] Migration completed successfully.');
}

if (require.main === module) {
  mongoose
    .connect(process.env.DATABASE_URL!, { serverSelectionTimeoutMS: 10000 })
    .then(async () => {
      await runMigration();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}
