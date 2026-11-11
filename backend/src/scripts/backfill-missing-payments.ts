/**
 * Backfills missing Payment records for bookings that are paid or completed,
 * ensuring all customers have complete payment transaction histories.
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-missing-payments.ts            # dry run
 *   npx ts-node src/scripts/backfill-missing-payments.ts --apply    # writes to DB
 */
import mongoose from 'mongoose';
import { BookingModel } from '../models/Booking';
import { PaymentModel } from '../models/Payment';

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.DATABASE_URL ?? process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) throw new Error('Set DATABASE_URL (or MONGODB_URI / MONGO_URI) in backend/.env');
  await mongoose.connect(uri);
  console.log(apply ? 'APPLY mode' : 'DRY RUN (add --apply to write)');

  const paidBookings = await BookingModel.find({
    $or: [
      { paymentStatus: 'PAID' },
      { 'paymentDetails.status': 'PAID' },
      { status: { $in: ['completed', 'rated'] } },
    ],
  }).lean();

  console.log(`Total paid or completed bookings: ${paidBookings.length}`);

  const bookingIds = paidBookings.map((b) => b._id);
  const existingPayments = await PaymentModel.find({
    bookingId: { $in: bookingIds },
  }).lean();

  const existingBookingIds = new Set(existingPayments.map((p) => String(p.bookingId)));
  const existingOrderIds = new Set(existingPayments.map((p) => p.razorpayOrderId).filter(Boolean));

  // 1. Pending payments for completed/settled bookings that need to be marked PAID
  const pendingPaymentsToUpdate = existingPayments.filter(
    (p) => p.status === 'PENDING' && !p.errorReason,
  );
  console.log(`Pending payments to mark as PAID: ${pendingPaymentsToUpdate.length}`);
  if (apply && pendingPaymentsToUpdate.length > 0) {
    const updateIds = pendingPaymentsToUpdate.map((p) => p._id);
    const now = new Date();
    await PaymentModel.updateMany(
      { _id: { $in: updateIds } },
      { $set: { status: 'PAID', paidAt: now, creditedAt: now } },
    );
  }

  // 2. Bookings completely missing a payment record
  const missing = paidBookings.filter((b) => !existingBookingIds.has(String(b._id)));
  console.log(`Missing payments to create: ${missing.length}`);

  if (missing.length === 0) {
    console.log('No missing payments found.');
    await mongoose.disconnect();
    return;
  }

  const docs = [];
  for (const b of missing) {
    const amount = Number(b.priceSnapshot?.total ?? (b as { priceBreakdown?: { total?: number } }).priceBreakdown?.total ?? 0);
    const paidAt = b.paymentDetails?.paidAt
      ? new Date(b.paymentDetails.paidAt)
      : (b as { completedAt?: Date }).completedAt
      ? new Date((b as { completedAt?: Date }).completedAt!)
      : b.updatedAt
      ? new Date(b.updatedAt)
      : b.createdAt
      ? new Date(b.createdAt)
      : new Date();

    let orderId = (b.paymentDetails?.orderId && String(b.paymentDetails.orderId).trim()) || `order_${String(b._id)}`;
    if (existingOrderIds.has(orderId)) {
      orderId = `order_${String(b._id)}_${Date.now().toString(36)}`;
    }
    existingOrderIds.add(orderId);

    const paymentId = (b.paymentDetails?.paymentId && String(b.paymentDetails.paymentId).trim()) || `pay_${String(b._id)}`;
    const method = b.paymentDetails?.method || ((b as { paymentMethod?: string }).paymentMethod === 'cash' ? 'cod' : 'netbanking');

    docs.push({
      bookingId: b._id,
      customerId: b.customerId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: b.paymentDetails?.signature,
      amount,
      currency: b.priceSnapshot?.currency || 'INR',
      method,
      attempts: 1,
      status: 'PAID' as const,
      paidAt,
      creditedAt: paidAt,
      refund: { status: 'none' as const },
      createdAt: paidAt,
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : paidAt,
    });
  }

  if (apply) {
    const inserted = await PaymentModel.insertMany(docs, { ordered: false });
    console.log(`Successfully backfilled ${inserted.length} payments!`);
  } else {
    console.log(`Dry run finished. Run with --apply to insert ${docs.length} payments.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
