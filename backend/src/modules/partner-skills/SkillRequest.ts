import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const SKILL_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type SkillRequestStatus = (typeof SKILL_REQUEST_STATUSES)[number];

/** A partner's request to add a new skill to their profile. It only counts once an admin approves it. */
const SkillRequestSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    /** Lower-case name, used to stop the same partner asking for the same skill twice. */
    nameKey: { type: String, required: true },
    status: { type: String, enum: SKILL_REQUEST_STATUSES, default: "pending", index: true },
    reviewNote: { type: String, trim: true, maxlength: 300 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

SkillRequestSchema.index({ partnerId: 1, nameKey: 1 }, { unique: true });

export type SkillRequest = InferSchemaType<typeof SkillRequestSchema>;

export const SkillRequestModel: Model<SkillRequest> =
  (models.SkillRequest as Model<SkillRequest> | undefined) ?? model<SkillRequest>("SkillRequest", SkillRequestSchema);

export default SkillRequestModel;
