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
    /** "How HomeCareX works" demo shown after admin approval. completedSteps only ever moves forward, one step at a time. */
    onboarding: {
      completedSteps: { type: Number, default: 0, min: 0 },
      completedAt: { type: Date },
      /** Set by an admin after the partner finishes the demo. Until then the partner cannot use the app. */
      approvedAt: { type: Date },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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