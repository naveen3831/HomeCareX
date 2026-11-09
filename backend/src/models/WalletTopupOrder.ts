import mongoose, { Document, Schema, type Model } from 'mongoose';

export const TOPUP_ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED'] as const;
export type TopupOrderStatus = (typeof TOPUP_ORDER_STATUSES)[number];

export interface IWalletTopupOrder extends Document {
  userId: string;
  razorpayOrderId: string;
  amount: number; // in rupees
  currency: string;
  attempts: number;
  status: TopupOrderStatus;
  errorReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTopupOrderSchema = new Schema<IWalletTopupOrder>(
  {
    userId: { type: String, required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    attempts: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: TOPUP_ORDER_STATUSES,
      default: 'PENDING',
      index: true,
    },
    errorReason: { type: String },
  },
  { timestamps: true }
);

export const WalletTopupOrderModel: Model<IWalletTopupOrder> =
  (mongoose.models.WalletTopupOrder as Model<IWalletTopupOrder>) ||
  mongoose.model<IWalletTopupOrder>('WalletTopupOrder', WalletTopupOrderSchema);

export default WalletTopupOrderModel;
