import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { SETTLEMENT_CHANNELS } from '../modules/earnings/earnings.constants';

export const ADMIN_WALLET_TYPES = ['partner_payout', 'commission'] as const;
export type AdminWalletType = (typeof ADMIN_WALLET_TYPES)[number];

/**
 * Platform (admin) wallet ledger. Amounts are SIGNED INR:
 *  - commission     (+)  platform commission recognised when a job's earning is settled
 *  - partner_payout (-)  net amount credited to the partner wallet at the same moment
 *                        (not written for cash-on-service jobs: the commission is cut from the partner wallet instead)
 * Balance = SUM(amount).
 *
 * Two sources write here, each idempotent on its own key:
 *  - per job (current flow):  one line per (type, earningId), written when an online-paid job completes
 *  - per payout (legacy):     one line per (type, payoutId), written when an old weekly batch was confirmed
 */
const AdminWalletTransactionSchema = new Schema(
  {
    type: { type: String, enum: ADMIN_WALLET_TYPES, required: true },
    amount: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => Number.isFinite(v) && v !== 0, message: 'amount must be a non-zero number' },
    },
    /** Legacy weekly-batch lines only. */
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout' },
    batchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', index: true },
    /** Per-job lines only: how the job's money moved (online / upi_qr / cod_cash). Missing on old lines = online. */
    channel: { type: String, enum: [...SETTLEMENT_CHANNELS] },
    /** Per-job lines only. */
    earningId: { type: Schema.Types.ObjectId, ref: 'Earning' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Partial, so lines that have no payoutId / earningId never collide on a shared `null` key.
AdminWalletTransactionSchema.index(
  { type: 1, payoutId: 1 },
  { unique: true, partialFilterExpression: { payoutId: { $exists: true } } },
);
AdminWalletTransactionSchema.index(
  { type: 1, earningId: 1 },
  { unique: true, partialFilterExpression: { earningId: { $exists: true } } },
);
AdminWalletTransactionSchema.index({ createdAt: -1 });

export type AdminWalletTransaction = InferSchemaType<typeof AdminWalletTransactionSchema>;

// `models.X ||` avoids OverwriteModelError under ts-node-dev hot reloads.
export const AdminWalletTransactionModel: Model<AdminWalletTransaction> =
  (models.AdminWalletTransaction as Model<AdminWalletTransaction> | undefined) ??
  model<AdminWalletTransaction>('AdminWalletTransaction', AdminWalletTransactionSchema);

export default AdminWalletTransactionModel;
