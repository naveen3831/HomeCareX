import { Schema, model } from "mongoose";

export const REFERRAL_SCOPES = ["ALL", "CATEGORY", "SERVICE"] as const;
export type ReferralScope = (typeof REFERRAL_SCOPES)[number];

/**
 * An admin-created referral offer: a customer who signs up with a friend's referral code
 * gets a discount on their FIRST booking, limited to the scope below.
 *   ALL      every service
 *   CATEGORY the services in `categoryIds`
 *   SERVICE  the services in `serviceIds`
 */
const programSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    scope: { type: String, enum: REFERRAL_SCOPES, required: true, default: "ALL" },
    categoryIds: { type: [Schema.Types.ObjectId], ref: "Category", default: [] },
    serviceIds: { type: [Schema.Types.ObjectId], ref: "Service", default: [] },
    discountType: { type: String, enum: ["PERCENT", "FLAT"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, min: 0, default: null },
    minOrder: { type: Number, min: 0, default: 0 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
    /** How many first bookings got this discount (informational). */
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const ReferralProgramModel = model("ReferralProgram", programSchema);
export default ReferralProgramModel;
