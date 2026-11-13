import mongoose, { Document, Schema, type Model } from 'mongoose';

export type LedgerType =
  | 'credit'
  | 'debit'
  | 'refund_credit'
  | 'referral_reward'
  | 'failed'
  | 'CREDIT'
  | 'DEBIT'
  | 'REFUND'
  | 'REFERRAL_REWARD'
  | 'FAILED';

export interface IWalletLedger extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: string;
  type: LedgerType;
  reason?: string;
  amount: number; // in rupees
  balanceAfter: number;
  description: string;
  referenceId?: string;
  bookingId?: mongoose.Types.ObjectId | string;
  referralId?: mongoose.Types.ObjectId | string;
  refundId?: mongoose.Types.ObjectId | string;
  createdAt: Date;
}

export interface IWallet extends Document {
  userId: string;
  balance: number; // in rupees
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

const WalletLedgerSchema = new Schema<IWalletLedger>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'credit',
        'debit',
        'refund_credit',
        'referral_reward',
        'failed',
        'CREDIT',
        'DEBIT',
        'REFUND',
        'REFERRAL_REWARD',
        'FAILED',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String, index: true },
    reason: { type: String, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    referralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
    refundId: { type: Schema.Types.ObjectId, ref: 'Refund' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WalletLedgerSchema.index({ userId: 1, createdAt: -1 });
WalletLedgerSchema.index(
  { userId: 1, referralId: 1, reason: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referralId: { $type: "objectId" },
    },
  }
);
WalletLedgerSchema.index({ bookingId: 1, reason: 1 });

export const WalletModel: Model<IWallet> =
  (mongoose.models.Wallet as Model<IWallet>) ||
  mongoose.model<IWallet>('Wallet', WalletSchema);

export const WalletLedgerModel: Model<IWalletLedger> =
  (mongoose.models.WalletLedger as Model<IWalletLedger>) ||
  mongoose.model<IWalletLedger>('WalletLedger', WalletLedgerSchema);

export default WalletModel;
