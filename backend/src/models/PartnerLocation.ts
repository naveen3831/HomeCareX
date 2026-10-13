import { Schema, model, type InferSchemaType, Types } from 'mongoose';

/** Latest shared position of the assigned partner for one booking. One row per booking, overwritten on every update. */
const PartnerLocationSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    /** Partner._id (not the User id). */
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    sharing: { type: Boolean, required: true, default: false },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    heading: { type: Number, min: 0, max: 360 },
    updatedAt: { type: Date },
  },
  { timestamps: false },
);

export type PartnerLocation = InferSchemaType<typeof PartnerLocationSchema> & { _id: Types.ObjectId };
export const PartnerLocationModel = model('PartnerLocation', PartnerLocationSchema);
export default PartnerLocationModel;