import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  KYC_DOCUMENT_STATUSES,
  KYC_DOCUMENT_TYPES,
  KYC_STATUSES,
} from '../modules/partners/partner-dashboard.constants';

const KycDocumentSchema = new Schema(
  {
    type: { type: String, enum: KYC_DOCUMENT_TYPES, required: true },
    /** Human label, e.g. "Aadhaar" / "PAN" / "Driving licence". */
    label: { type: String },
    /** Legacy external URL. New uploads use storageKey and are served by the admin-only document endpoint. */
    url: { type: String },
    storageKey: { type: String },
    mimeType: { type: String },
    originalName: { type: String },
    status: { type: String, enum: KYC_DOCUMENT_STATUSES, default: 'pending' },
    reviewNote: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

/** Partner profile. One per partner User (userId). Contract for onboarding + dashboard modules. */
const PartnerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    skills: [{ type: String, trim: true }],
    services: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    serviceRadiusKm: { type: Number, default: 10, min: 1, max: 100 },
    /** Shown on the admin Partners & KYC profile. Must be in the schema or Mongoose silently drops it on save. */
    experience: { type: Number, default: 0, min: 0, max: 60 },
    bio: { type: String, trim: true, maxlength: 500 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    /** Counters maintained by matching/booking services; rates are derived from these. */
    stats: {
      offersReceived: { type: Number, default: 0, min: 0 },
      offersAccepted: { type: Number, default: 0, min: 0 },
      jobsAssigned: { type: Number, default: 0, min: 0 },
      jobsCompleted: { type: Number, default: 0, min: 0 },
    },
    kyc: {
      status: { type: String, enum: [...KYC_STATUSES, 'not_submitted'], default: 'not_started', index: true },
      documents: { type: [KycDocumentSchema], default: [] },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      rejectionReason: { type: String },
      suspensionReason: { type: String },
    },
    trainingCompleted: { type: Boolean, default: false },
    /** Progress of the post-approval demo (see partner-onboarding module). Must be in the schema or Mongoose drops the writes. */
    onboarding: {
      completedSteps: { type: Number, default: 0, min: 0 },
      completedAt: { type: Date },
      approvedAt: { type: Date },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    /** Home address the partner gave at registration. Shown on the admin Partners & KYC pages. */
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 60 },
      state: { type: String, trim: true, maxlength: 60 },
      pincode: { type: String, trim: true, maxlength: 10 },
    },
    /** Never store the full account number here; keep it with the payout provider. */
    bankDetails: {
      accountHolder: { type: String },
      accountLast4: { type: String, match: /^\d{4}$/ },
      ifsc: { type: String, uppercase: true },
      upiId: { type: String },
    },
  },
  { timestamps: true },
);

export type Partner = InferSchemaType<typeof PartnerSchema>;
export const PartnerModel = model('Partner', PartnerSchema);
export default PartnerModel;