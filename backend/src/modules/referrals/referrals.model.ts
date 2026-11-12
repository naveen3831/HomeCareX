import { Schema, model } from "mongoose";

const codeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);
export const ReferralCodeModel = model("ReferralCode", codeSchema);

/**
 * One code per (customer, referral offer): each admin-created offer gets its own code for every customer,
 * so a friend who signs up with it gets exactly that offer on their first booking.
 */
const offerCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    referrerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    programId: { type: Schema.Types.ObjectId, ref: "ReferralProgram", required: true },
  },
  { timestamps: true },
);
offerCodeSchema.index({ referrerId: 1, programId: 1 }, { unique: true });
export const ReferralOfferCodeModel = model("ReferralOfferCode", offerCodeSchema);

const schema = new Schema(
  {
    code: { type: String, required: true },
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refereeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["invited", "completed", "rewarded"],
      default: "invited",
      required: true,
    },
    rewardPaise: { type: Number, default: 0, min: 0 },
    firstBookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    /** The offer whose code the friend signed up with (null = generic code: best offer applies). */
    programId: { type: Schema.Types.ObjectId, ref: "ReferralProgram", default: null },
    /** The new customer's own first-booking discount (set when that booking is created). */
    discountBookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    discountProgramId: { type: Schema.Types.ObjectId, ref: "ReferralProgram" },
    discountAmount: { type: Number, default: 0, min: 0 },
    rewardedAt: { type: Date },
  },
  { timestamps: true },
);
schema.index({ referrerId: 1, createdAt: -1 });
export const ReferralModel = model("Referral", schema);