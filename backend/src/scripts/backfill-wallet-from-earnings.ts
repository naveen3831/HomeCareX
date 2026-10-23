/**
 * One-off, safe to re-run: gives every existing Earning its wallet ledger line (and the payout debit for
 * payouts already marked paid). Run once after deploying the wallet-credit change, so earnings created
 * before it show up in the partner Wallet.
 *
 *   npx ts-node src/scripts/backfill-wallet-from-earnings.ts
 */
import mongoose from 'mongoose';
import EarningModel from '../modules/earnings/Earning';
import PayoutModel from '../models/Payout';
import { partnerWalletLedger } from '../modules/partner-wallet/partner-wallet.ledger';

async function main() {
  const uri = process.env.DATABASE_URL ?? process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) throw new Error('Set DATABASE_URL (or MONGODB_URI / MONGO_URI) in backend/.env');
  await mongoose.connect(uri);

  let earnings = 0;
  for await (const e of EarningModel.find({}).lean()) {
    await partnerWalletLedger.creditEarning({
      partnerId: String(e.partnerId),
      earningId: String(e._id),
      bookingId: String(e.bookingId),
      net: e.net,
    });
    earnings += 1;
  }
  // creditEarning writes `pending`; earnings already cleared by a batch must be `settled`.
  const settledIds = (await EarningModel.find({ status: 'settled' }).select('_id').lean()).map((e) => String(e._id));
  await partnerWalletLedger.settleEarnings(settledIds);

  let payouts = 0;
  for await (const p of PayoutModel.find({ status: 'paid' }).lean()) {
    if (!p.partnerId) continue;
    await partnerWalletLedger.debitPayout({ partnerId: String(p.partnerId), payoutId: String(p._id), amount: p.amount });
    payouts += 1;
  }

  console.log(`Backfilled ${earnings} earnings and ${payouts} paid payouts`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});