import { Schema, model } from 'mongoose';

export const PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'failed'] as const;

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
  },
  { timestamps: true },
);

export const PayoutModel = model('Payout', PayoutSchema);
export default PayoutModel;
