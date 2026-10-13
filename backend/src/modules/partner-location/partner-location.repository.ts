import type { Types } from "mongoose";
import PartnerLocationModel from "../../models/PartnerLocation";

export interface LocationDoc {
  bookingId: Types.ObjectId;
  partnerId: Types.ObjectId;
  sharing: boolean;
  lat?: number;
  lng?: number;
  accuracy?: number;
  heading?: number;
  updatedAt?: Date;
}

export interface LocationFix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
}

export const partnerLocationRepository = {
  find(bookingId: string) {
    return PartnerLocationModel.findOne({ bookingId }).lean<LocationDoc>();
  },

  save(
    bookingId: Types.ObjectId,
    partnerId: Types.ObjectId,
    fix: LocationFix,
  ): Promise<LocationDoc> {
    return PartnerLocationModel.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          partnerId,
          sharing: true,
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          heading: fix.heading,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<LocationDoc>() as Promise<LocationDoc>;
  },

  /** Keeps the last known position; only flips the flag. Returns null when nothing was ever shared. */
  stop(bookingId: string, partnerId: Types.ObjectId) {
    return PartnerLocationModel.findOneAndUpdate(
      { bookingId, partnerId },
      { $set: { sharing: false } },
      { new: true },
    ).lean<LocationDoc>();
  },
};
