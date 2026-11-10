/**
 * One-off, safe to re-run. Run it once after deploying the "Paid only after credit" + cash-commission change.
 *
 *   1. Payments of jobs whose earning is already settled get `creditedAt`, so the admin Payments page shows them as Paid.
 *   2. Earnings settled before this change get settlementChannel = 'online' (they were all online jobs).
 *   3. Cash-on-service jobs the partner already collected but that were never settled are listed. With --apply they are
 *      settled now: the admin commission is cut from the partner wallet (same code path as a live cash collection).
 *
 *   npx ts-node src/scripts/backfill-payment-credited.ts            # dry run, only prints what it would do
 *   npx ts-node src/scripts/backfill-payment-credited.ts --apply    # does it
 */
import mongoose from 'mongoose';
import BookingModel from '../models/Booking';
import PaymentModel from '../models/Payment';
import EarningModel from '../modules/earnings/Earning';
import { settleEarningForBooking } from '../modules/earnings/earnings.settle';

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.DATABASE_URL ?? process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) throw new Error('Set DATABASE_URL (or MONGODB_URI / MONGO_URI) in backend/.env');
  await mongoose.connect(uri);
  console.log(apply ? 'APPLY mode' : 'DRY RUN (add --apply to write)');

  // 2) channel for old settled earnings
  const noChannel = await EarningModel.countDocuments({ status: 'settled', settlementChannel: null });
  console.log(`Settled earnings without a channel: ${noChannel}`);
  if (apply && noChannel) {
    await EarningModel.updateMany({ status: 'settled', settlementChannel: null }, { $set: { settlementChannel: 'online' } });
  }

  // 1) creditedAt for payments whose earning is settled
  let credited = 0;
  for await (const e of EarningModel.find({ status: 'settled' }).select('bookingId settledAt').lean()) {
    const filter = { bookingId: e.bookingId, status: 'PAID' as const, creditedAt: null };
    const open = await PaymentModel.countDocuments(filter);
    if (!open) continue;
    credited += open;
    if (apply) await PaymentModel.updateMany(filter, { $set: { creditedAt: e.settledAt ?? new Date() } });
  }
  console.log(`Payments to mark as credited: ${credited}`);

  // 3) cash / QR jobs collected by the partner but never settled
  const stuck = await BookingModel.find({
    paymentStatus: 'PAID',
    'paymentDetails.collectedBy': { $in: ['partner', 'platform'] },
  })
    .select('_id')
    .lean();
  let settled = 0;
  let skipped = 0;
  for (const b of stuck) {
    const earning = await EarningModel.findOne({ bookingId: b._id, status: 'pending' }).select('_id').lean();
    if (!earning) continue;
    if (!apply) {
      settled += 1;
      continue;
    }
    const result = await settleEarningForBooking(String(b._id));
    if (result.settled) settled += 1;
    else skipped += 1;
  }
  console.log(`Collected jobs ${apply ? 'settled' : 'that would be settled'}: ${settled}${skipped ? `, skipped: ${skipped}` : ''}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
