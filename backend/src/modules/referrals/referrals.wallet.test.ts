import dotenv from 'dotenv';
dotenv.config();
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { referralsService } from './referrals.service';
import { ReferralModel } from './referrals.model';
import { ReferralProgramModel } from './referral-programs.model';
import { WalletModel, WalletLedgerModel } from '../../models/Wallet';
import { BookingModel, BOOKING_PAYMENT_STATUS } from '../../models/Booking';
import { BOOKING_STATUS } from '../bookings/bookings.constants';

test('Referral Wallet Flow Suite', async (t) => {
  await mongoose.connect(process.env.DATABASE_URL || '');
  const userId = new Types.ObjectId().toString();
  const referrerId = new Types.ObjectId().toString();
  const serviceId = new Types.ObjectId().toString();

  try {
    await t.test('1. getEligibility credits reward to wallet once and returns correct flags', async () => {
      // Setup program
      const program = await ReferralProgramModel.create({
        name: 'welcom friend test',
        scope: 'ALL',
        discountType: 'FLAT',
        value: 160,
        active: true,
        minOrder: 100,
      });

      // Setup referral doc
      const ref = await ReferralModel.create({
        refereeId: new Types.ObjectId(userId),
        referrerId: new Types.ObjectId(referrerId),
        programId: program._id,
        code: 'HCXTEST-WELCOMFR',
        status: 'invited',
        referralUsed: false,
      });

      // Check eligibility
      const elig1 = await referralsService.getEligibility(userId, serviceId, 799);
      assert.equal(elig1.eligible, true);
      assert.equal(elig1.rewardAmount, 160);
      assert.equal(elig1.referralId, String(ref._id));
      assert.equal(elig1.alreadyCredited, true);
      assert.equal(elig1.alreadyUsed, false);

      // Verify wallet balance
      const wallet1 = await WalletModel.findOne({ userId });
      assert.ok(wallet1);
      assert.equal(wallet1.balance, 160);

      // Verify ledger
      const ledger1 = await WalletLedgerModel.find({ userId, reason: 'REFERRAL' });
      assert.equal(ledger1.length, 1);
      assert.equal(ledger1[0].amount, 160);

      // Calling getEligibility a second time is idempotent: does NOT credit again
      const elig2 = await referralsService.getEligibility(userId, serviceId, 799);
      assert.equal(elig2.eligible, true);
      assert.equal(elig2.alreadyCredited, true);

      const wallet2 = await WalletModel.findOne({ userId });
      assert.equal(wallet2?.balance, 160);
    });

    await t.test('2. refundWalletUsed refunds deducted wallet and resets referralUsed idempotently', async () => {
      const bookingId = new Types.ObjectId().toString();

      // Create a mock booking where wallet_used = 160
      await BookingModel.create({
        _id: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(userId),
        serviceId: new Types.ObjectId(serviceId),
        serviceName: 'General Pest Control',
        address: {
          line1: '123 Test St',
          city: 'Hyderabad',
          pincode: '500001',
        },
        scheduledAt: new Date('2026-11-20T14:00:00Z'),
        date: '2026-11-20',
        slot: '14:00-16:00',
        status: BOOKING_STATUS.PENDING_PAYMENT,
        paymentStatus: BOOKING_PAYMENT_STATUS.PENDING,
        wallet_used: 160,
        payable: 628,
        priceSnapshot: { total: 788, discount: 160 },
      } as any);

      // Mark referral as used
      await ReferralModel.updateOne(
        { refereeId: new Types.ObjectId(userId) },
        { $set: { referralUsed: true, usedAt: new Date(), discountBookingId: new Types.ObjectId(bookingId), discountAmount: 160 } }
      );

      // Set wallet balance to 0 (since it was deducted)
      await WalletModel.updateOne({ userId }, { $set: { balance: 0 } });

      // Call refundWalletUsed
      await referralsService.refundWalletUsed(bookingId);

      // Verify wallet balance is refunded back to 160
      const wallet = await WalletModel.findOne({ userId });
      assert.equal(wallet?.balance, 160);

      // Verify ledger has REFUND entry
      const refundLedger = await WalletLedgerModel.findOne({ bookingId: new Types.ObjectId(bookingId), reason: 'REFUND' });
      assert.ok(refundLedger);
      assert.equal(refundLedger.amount, 160);
      assert.equal(refundLedger.type, 'CREDIT');

      // Verify referral doc is marked unused again
      const refDoc = await ReferralModel.findOne({ refereeId: new Types.ObjectId(userId) });
      assert.equal(refDoc?.referralUsed, false);
      assert.equal(refDoc?.discountBookingId, null);

      // Calling refundWalletUsed a second time is idempotent
      await referralsService.refundWalletUsed(bookingId);
      const walletAfterSecondRefund = await WalletModel.findOne({ userId });
      assert.equal(walletAfterSecondRefund?.balance, 160);
    });
  } finally {
    // Cleanup test docs
    await ReferralProgramModel.deleteMany({ name: 'welcom friend test' });
    await ReferralModel.deleteMany({ refereeId: new Types.ObjectId(userId) });
    await WalletModel.deleteMany({ userId });
    await WalletLedgerModel.deleteMany({ userId });
    await mongoose.disconnect();
  }
});
