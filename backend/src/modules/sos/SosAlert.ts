import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const SOS_STATUSES = ["active", "acknowledged", "resolved"] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

/** One emergency alert raised by a partner. `triggeredAt` is the moment the partner pressed SOS. */
const SosAlertSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    location: {
      type: new Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
          accuracy: { type: Number, min: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
    note: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: SOS_STATUSES, default: "active", index: true },
    triggeredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

SosAlertSchema.index({ partnerId: 1, triggeredAt: -1 });

export type SosAlert = InferSchemaType<typeof SosAlertSchema>;

// `models.X ||` avoids OverwriteModelError under ts-node-dev hot reloads.
export const SosAlertModel: Model<SosAlert> =
  (models.SosAlert as Model<SosAlert> | undefined) ?? model<SosAlert>("SosAlert", SosAlertSchema);

export default SosAlertModel;
