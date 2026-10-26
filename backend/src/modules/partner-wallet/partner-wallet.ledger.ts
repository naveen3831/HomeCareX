import { Types } from 'mongoose';
import WalletTransactionModel from './WalletTransaction';
import type { WalletTransactionStatus } from './partner-wallet.constants';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const isDuplicateKeyError = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;

/**
 * Insert-if-missing keyed by (partnerId, type, referenceId). Running it twice for the same source
 * (a repeated job.completed event, a double click on "mark paid") never creates a second ledger line.
 */
async function upsertLine(
  key: { partnerId: string; type: 'earning' | 'payout'; referenceId: string },
  fields: { amount: number; status: WalletTransactionStatus; description: string; bookingId?: string },
): Promise<void> {
  try {
    await WalletTransactionModel.updateOne(
      { partnerId: new Types.ObjectId(key.partnerId), type: key.type, referenceId: key.referenceId },
      {
        $setOnInsert: {
          amount: fields.amount,
          status: fields.status,
          description: fields.description,
          ...(fields.bookingId ? { bookingId: new Types.ObjectId(fields.bookingId) } : {}),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    // Two concurrent callers raced on the unique index: the line exists, which is all we wanted.
    if (!isDuplicateKeyError(err)) throw err;
  }
}

/** The only code that writes earning/payout lines into the partner wallet ledger. Amounts are signed INR. */
export const partnerWalletLedger = {
  /** Earning created -> +net, `pending` until a payout batch picks it up. */
  async creditEarning(input: { partnerId: string; earningId: string; bookingId: string; net: number }): Promise<void> {
    const amount = round2(input.net);
    if (amount <= 0) return; // the ledger rejects zero lines, and a zero earning moves no money
    await upsertLine(
      { partnerId: input.partnerId, type: 'earning', referenceId: input.earningId },
      { amount, status: 'pending', description: 'Job earning', bookingId: input.bookingId },
    );
  },

  /** Payout batch generated -> these earnings are now cleared and count in the available balance. */
  async settleEarnings(earningIds: string[]): Promise<void> {
    if (!earningIds.length) return;
    await WalletTransactionModel.updateMany({ type: 'earning', referenceId: { $in: earningIds } }, { $set: { status: 'settled' } });
  },

  /** Rollback helper for a batch that failed half way. */
  async unsettleEarnings(earningIds: string[]): Promise<void> {
    if (!earningIds.length) return;
    await WalletTransactionModel.updateMany({ type: 'earning', referenceId: { $in: earningIds } }, { $set: { status: 'pending' } });
  },

  /** Payout marked paid -> -amount, settled (money left the wallet). */
  async debitPayout(input: { partnerId: string; payoutId: string; amount: number }): Promise<void> {
    const amount = round2(input.amount);
    if (amount <= 0) return;
    await upsertLine(
      { partnerId: input.partnerId, type: 'payout', referenceId: input.payoutId },
      { amount: -amount, status: 'settled', description: 'Payout to your account' },
    );
  },
};

export type PartnerWalletLedger = typeof partnerWalletLedger;
