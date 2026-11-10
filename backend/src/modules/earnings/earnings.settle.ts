import { Types } from 'mongoose';
import BookingModel from '../../models/Booking';
import PaymentModel from '../../models/Payment';
import EarningModel from './Earning';
import { earningsService } from './earnings.service';
import type { SettlementChannel } from './earnings.constants';
import { partnerWalletLedger } from '../partner-wallet/partner-wallet.ledger';
import { adminWalletLedger } from '../payouts/payouts.ledger';

export type SettleEarningOutcome =
  | { settled: true; earningId: string; partnerNet: number; commission: number; channel: SettlementChannel }
  | { settled: false; reason: 'no_booking' | 'no_earning' | 'not_paid' | 'in_legacy_batch' };

/** How was this booking paid? Decided only from what the booking itself says. */
export function channelOf(booking: { paymentDetails?: { collectedBy?: string } | null }): SettlementChannel {
  const by = booking.paymentDetails?.collectedBy;
  if (by === 'partner') return 'cod_cash'; // partner took cash: commission is cut from the partner wallet
  if (by === 'platform') return 'upi_qr'; // customer paid the platform UPI via the partner's QR: online process
  return 'online'; // paid online through the gateway
}

/** The admin Payments page shows "Paid" only once this is set. */
async function markPaymentsCredited(bookingId: string, at: Date): Promise<void> {
  await PaymentModel.updateMany(
    { bookingId: new Types.ObjectId(bookingId), status: 'PAID', creditedAt: null },
    { $set: { creditedAt: at } },
  );
}

/**
 * Settles a finished AND paid job. Three ways the money can have moved:
 *
 *  online    paid through the gateway          -> partner net -> partner wallet (available), commission -> admin wallet
 *  upi_qr    cash-on-service, customer paid    -> same as online (the money is with the platform)
 *            the platform UPI by scanning QR
 *  cod_cash  cash-on-service, partner took     -> the partner already holds the money, so NOTHING is credited to
 *            the cash                             them; the admin commission is DEBITED from the partner wallet
 *                                                 and recorded in the admin wallet
 *
 * Call it when the job completes (online jobs are already paid then) and again when the partner collects the payment
 * (cash / QR jobs are paid after completion). It is idempotent: the pending -> settled flip is one atomic update
 * and every ledger write is insert-if-missing, so repeated calls (event replays, double taps, repair scripts) never
 * pay or charge twice.
 */
export async function settleEarningForBooking(bookingId: string): Promise<SettleEarningOutcome> {
  if (!Types.ObjectId.isValid(bookingId)) return { settled: false, reason: 'no_booking' };

  const booking = await BookingModel.findById(bookingId)
    .select('paymentStatus paymentDetails partnerId priceBreakdown completedAt')
    .lean();
  if (!booking) return { settled: false, reason: 'no_booking' };
  if (booking.paymentStatus !== 'PAID') return { settled: false, reason: 'not_paid' };

  let earning = await EarningModel.findOne({ bookingId: new Types.ObjectId(bookingId) });
  if (!earning && booking.partnerId) {
    // The partner collected before the job.completed listener wrote the earning: create it now (idempotent).
    const gross = Number(booking.priceBreakdown?.total ?? 0);
    if (Number.isFinite(gross) && gross > 0) {
      await earningsService.recordJobCompleted({
        bookingId,
        partnerId: String(booking.partnerId),
        gross,
        completedAt: booking.completedAt ?? new Date(),
      });
      earning = await EarningModel.findOne({ bookingId: new Types.ObjectId(bookingId) });
    }
  }
  if (!earning) return { settled: false, reason: 'no_earning' };

  // Old weekly batches settle through their own confirm flow; never touch those (only mark the payment credited).
  if (earning.payoutBatchId) {
    if (earning.status === 'settled') await markPaymentsCredited(bookingId, earning.settledAt ?? new Date());
    return { settled: false, reason: 'in_legacy_batch' };
  }

  const channel = channelOf(booking);
  const now = new Date();

  // Atomic: exactly one caller flips the status. Losers fall through to the (idempotent) ledger repair below.
  await EarningModel.updateOne(
    { _id: earning._id, status: 'pending', payoutBatchId: null },
    { $set: { status: 'settled', settledAt: now, settlementChannel: channel } },
  );

  const fresh = await EarningModel.findById(earning._id).lean();
  const effective: SettlementChannel = (fresh?.settlementChannel as SettlementChannel | null | undefined) ?? channel;
  const earningId = String(earning._id);
  const partnerId = String(earning.partnerId);

  if (effective === 'cod_cash') {
    // Partner holds the cash: drop the "pending earning" line and cut the commission from the wallet.
    await partnerWalletLedger.voidEarning(earningId);
    await partnerWalletLedger.deductCommission({ partnerId, earningId, bookingId, commission: earning.commission });
    await adminWalletLedger.recordCashJobCommission({ earningId, bookingId, partnerId, commission: earning.commission });
  } else {
    await partnerWalletLedger.settleEarnings([earningId]);
    await adminWalletLedger.recordJobSettled({
      earningId,
      bookingId,
      partnerId,
      commission: earning.commission,
      net: earning.net,
      channel: effective,
    });
  }

  await markPaymentsCredited(bookingId, fresh?.settledAt ?? now);

  return { settled: true, earningId, partnerNet: earning.net, commission: earning.commission, channel: effective };
}
