import { Schema, model, type InferSchemaType, Types } from 'mongoose';

/** Where one partner works. One row per partner; matching reads it to decide which jobs to offer. */
const ServiceAreaSchema = new Schema(
  {
    /** Partner._id (not the User id). */
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, unique: true },
    baseLocation: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      label: { type: String, trim: true, maxlength: 120, default: '' },
    },
    cities: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    /** Preferred neighbourhoods inside the cities. Optional. */
    areas: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
    radiusKm: { type: Number, required: true, min: 1, max: 50 },
  },
  { timestamps: true },
);

export type ServiceArea = InferSchemaType<typeof ServiceAreaSchema> & { _id: Types.ObjectId };
export const ServiceAreaModel = model('ServiceArea', ServiceAreaSchema);
export default ServiceAreaModel;
