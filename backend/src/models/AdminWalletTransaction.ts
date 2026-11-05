import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const ADMIN_WALLET_TYPES = ['partner_payout', 'commission'] as const;
export type AdminWalletType = (typeof ADMIN_WALLET_TYPES)[number];

/**
 * Platform (admin) wallet ledger. Amounts are SIGNED INR:
 *  - commission     (+)  platform commission recognised when a payout is confirmed
 *  - partner_payout (-)  net amount credited to a partner wallet when a payout is confirmed
 * Balance = SUM(amount). One line per (type, payoutId) so confirming twice never double counts.
 */
const AdminWalletTransactionSchema = new Schema(
  {
    type: { type: String, enum: ADMIN_WALLET_TYPES, required: true },
    amount: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => Number.isFinite(v) && v !== 0, message: 'amount must be a non-zero number' },
    },
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AdminWalletTransactionSchema.index({ type: 1, payoutId: 1 }, { unique: true });
AdminWalletTransactionSchema.index({ createdAt: -1 });

export type AdminWalletTransaction = InferSchemaType<typeof AdminWalletTransactionSchema>;

// `models.X ||` avoids OverwriteModelError under ts-node-dev hot reloads.
export const AdminWalletTransactionModel: Model<AdminWalletTransaction> =
  (models.AdminWalletTransaction as Model<AdminWalletTransaction> | undefined) ??
  model<AdminWalletTransaction>('AdminWalletTransaction', AdminWalletTransactionSchema);

export default AdminWalletTransactionModel;
