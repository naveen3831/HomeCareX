import { Schema, model } from 'mongoose';

export const PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'failed'] as const;

export const PAYOUT_METHODS = ['bank_transfer', 'upi'] as const;

/** Minimal shape needed by dashboards. `pending` + `processing` + `failed` = the payout backlog. */
const PayoutSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', required: true, index: true },
    gross: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'pending', index: true },
    paidAt: { type: Date },
    /** Added for the partner payouts page; all optional so older documents stay valid. */
    method: { type: String, enum: PAYOUT_METHODS },
    transactionId: { type: String, trim: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', index: true },
    expectedDate: { type: Date },
    failureReason: { type: String, trim: true },
  },
  { timestamps: true },
);

export const PayoutModel = model('Payout', PayoutSchema);
export default PayoutModel;