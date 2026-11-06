
import { Schema, model } from 'mongoose';

export const PAYOUT_STATUSES = [
  'pending',
  'processing',
  'paid',
  'failed',
] as const;

export const PAYOUT_METHODS = [
  'bank_transfer',
  'upi',
] as const;

/**
 * Payout model.
 *
 * Supports admin payout dashboards and partner payout pages.
 * Older documents can omit optional fields such as method,
 * transactionId, expectedDate, and failureReason.
 */
const PayoutSchema = new Schema(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'PayoutBatch',
      required: true,
      index: true,
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Earnings (one per completed service) that make up this payout. Used for the day-wise service breakdown. */
    earningIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Earning',
    }],
    /** Number of services (earnings) included in this payout. */
    servicesCount: {
      type: Number,
      default: 0,
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
    method: {
      type: String,
      enum: PAYOUT_METHODS,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    expectedDate: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const PayoutModel = model('Payout', PayoutSchema);

export default PayoutModel;
