import mongoose, { Document, Schema } from "mongoose";

export type LedgerType =
  | "credit"
  | "debit"
  | "refund_credit"
  | "referral_reward"
  | "failed"
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "REFERRAL_REWARD"
  | "FAILED";

export interface IWalletLedger extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: string;
  type: LedgerType;
  amount: number; // in rupees
  balanceAfter: number; // in rupees
  description: string;
  referenceId?: string;
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
    // unique: true already creates the index, so no separate index: true
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

const WalletLedgerSchema = new Schema<IWalletLedger>(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        "credit",
        "debit",
        "refund_credit",
        "referral_reward",
        "failed",
        "CREDIT",
        "DEBIT",
        "REFUND",
        "REFERRAL_REWARD",
        "FAILED",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    // indexed below as a partial unique index
    referenceId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Prevents the same payment from being credited twice (ignores entries without a referenceId)
WalletLedgerSchema.index(
  { referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: "string" } },
  },
);

export const WalletModel = mongoose.model<IWallet>("Wallet", WalletSchema);
export const WalletLedgerModel = mongoose.model<IWalletLedger>(
  "WalletLedger",
  WalletLedgerSchema,
);
