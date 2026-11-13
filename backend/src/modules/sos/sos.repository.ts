import { Types } from "mongoose";
import BookingModel from "../../models/Booking";
import PartnerModel from "../../models/Partner";
import UserModel from "../../models/User";
import SosAlertModel, { type SosStatus } from "./SosAlert";
import type { SosLocation } from "./sos.types";

export interface SosRowRaw {
  id: string;
  partnerId: string;
  bookingId: string | null;
  location: SosLocation | null;
  status: SosStatus;
  triggeredAt: Date;
}

type SosLean = {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  bookingId?: Types.ObjectId | null;
  location?: SosLocation | null;
  status: SosStatus;
  triggeredAt: Date;
};

const mapRow = (r: SosLean): SosRowRaw => ({
  id: String(r._id),
  partnerId: String(r.partnerId),
  bookingId: r.bookingId ? String(r.bookingId) : null,
  location: r.location ? { lat: r.location.lat, lng: r.location.lng, accuracy: r.location.accuracy } : null,
  status: r.status,
  triggeredAt: r.triggeredAt,
});

export const sosRepository = {
  findPartnerIdByUserId: async (userId: string): Promise<string | null> => {
    const partner = await PartnerModel.findOne({ userId }).select("_id").lean();
    return partner ? String(partner._id) : null;
  },

  /** Name and phone of the partner, for the admin alert. Null when either record is missing. */
  findPartnerSummary: async (partnerId: string): Promise<{ name: string; phone?: string } | null> => {
    const partner = await PartnerModel.findById(partnerId).select("userId").lean();
    if (!partner) return null;
    const user = await UserModel.findById(partner.userId).select("name phone").lean<{ name?: string; phone?: string }>();
    return user?.name ? { name: user.name, phone: user.phone } : null;
  },

  /** True only when the booking exists AND is assigned to this partner. */
  bookingBelongsToPartner: async (bookingId: string, partnerId: string): Promise<boolean> => {
    const found = await BookingModel.exists({ _id: bookingId, partnerId: new Types.ObjectId(partnerId) });
    return Boolean(found);
  },

  /** An unresolved alert from this partner raised at or after `since`. */
  findRecentActive: async (partnerId: string, since: Date): Promise<SosRowRaw | null> => {
    const row = await SosAlertModel.findOne({
      partnerId: new Types.ObjectId(partnerId),
      status: "active",
      triggeredAt: { $gte: since },
    })
      .sort({ triggeredAt: -1 })
      .lean<SosLean>();
    return row ? mapRow(row) : null;
  },

  create: async (input: {
    partnerId: string;
    bookingId: string | null;
    location: SosLocation | null;
    note?: string;
    triggeredAt: Date;
  }): Promise<SosRowRaw> => {
    const doc = await SosAlertModel.create({
      partnerId: new Types.ObjectId(input.partnerId),
      bookingId: input.bookingId ? new Types.ObjectId(input.bookingId) : null,
      location: input.location,
      note: input.note,
      status: "active",
      triggeredAt: input.triggeredAt,
    });
    return mapRow(doc.toObject() as unknown as SosLean);
  },
};

export type SosRepository = typeof sosRepository;
