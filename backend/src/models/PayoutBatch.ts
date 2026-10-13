
import { Schema, model, models } from 'mongoose';

export const PAYOUT_BATCH_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

const PayoutBatchSchema = new Schema(
  {
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    gross: {
      type: Number,
      required: true,
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    net: {
      type: Number,
      required: true,
      min: 0,
    },
    earningIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Earning',
      required: true,
    }],
    payoutIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Payout',
      default: [],
    }],
    status: {
      type: String,
      enum: PAYOUT_BATCH_STATUSES,
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

PayoutBatchSchema.index(
  { periodStart: 1, periodEnd: 1 },
  { unique: true },
);

export const PayoutBatchModel =
  models.PayoutBatch ||
  model('PayoutBatch', PayoutBatchSchema);

export default PayoutBatchModel;