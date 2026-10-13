
import { Schema, model, models } from 'mongoose';

export const PAYOUT_STATUSES = [
  'pending',
  'processing',
  'paid',
  'failed',
] as const;

const PayoutSchema = new Schema(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'PayoutBatch',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      default: 'pending',
      index: true,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

PayoutSchema.index({ batchId: 1, partnerId: 1 }, { unique: true });

export const PayoutModel =
  models.Payout || model('Payout', PayoutSchema);

export default PayoutModel;