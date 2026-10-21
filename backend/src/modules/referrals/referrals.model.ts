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
    rewardedAt: { type: Date },
  },
  { timestamps: true },
);
schema.index({ referrerId: 1, createdAt: -1 });
export const ReferralModel = model("Referral", schema);
