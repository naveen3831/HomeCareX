import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { BANK_ACCOUNT_TYPES, WITHDRAWAL_STATUSES } from './partner-withdrawals.constants';

/** A payout destination a partner saved (bank account or UPI ID). Soft-deleted so old requests keep their history. */
const BankAccountSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    type: { type: String, enum: BANK_ACCOUNT_TYPES, required: true },
    accountHolder: { type: String, trim: true, maxlength: 80, required: true },
    bankName: { type: String, trim: true, maxlength: 80 },
    ifsc: { type: String, uppercase: true, trim: true },
    /** AES-256-GCM, never returned by a partner endpoint. */
    accountNumberEnc: { type: String },
    accountLast4: { type: String, match: /^\d{4}$/ },
    upiId: { type: String, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);
BankAccountSchema.index({ partnerId: 1, deletedAt: 1 });

/** Snapshot of where the money goes, copied at request time so editing/deleting the account later changes nothing. */
const DestinationSchema = new Schema(
  {
    type: { type: String, enum: BANK_ACCOUNT_TYPES, required: true },
    accountHolder: { type: String, required: true },
    bankName: { type: String },
    ifsc: { type: String },
    accountNumberEnc: { type: String },
    accountLast4: { type: String },
    upiId: { type: String },
  },
  { _id: false },
);

const WithdrawalSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: WITHDRAWAL_STATUSES, default: 'pending', index: true },
    destination: { type: DestinationSchema, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 300 },
    transactionId: { type: String, trim: true, maxlength: 80 },
    paidAt: { type: Date },
  },
  { timestamps: true },
);
// One open request per partner. This is also what stops two quick taps from over-withdrawing.
WithdrawalSchema.index({ partnerId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_partner' });
WithdrawalSchema.index({ status: 1, createdAt: -1 });

export type BankAccountDoc = InferSchemaType<typeof BankAccountSchema>;
export type WithdrawalDoc = InferSchemaType<typeof WithdrawalSchema>;

export const BankAccountModel: Model<BankAccountDoc> =
  (models.PartnerBankAccount as Model<BankAccountDoc> | undefined) ?? model<BankAccountDoc>('PartnerBankAccount', BankAccountSchema);
export const WithdrawalModel: Model<WithdrawalDoc> =
  (models.WithdrawalRequest as Model<WithdrawalDoc> | undefined) ?? model<WithdrawalDoc>('WithdrawalRequest', WithdrawalSchema);
