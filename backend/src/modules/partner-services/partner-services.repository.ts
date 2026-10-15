import type { Types } from "mongoose";
import PartnerModel from "../../models/Partner";
import ServiceModel from "../../models/Service";
import ServiceAreaModel from "../../models/ServiceArea";
import type { ServiceAreaBody } from "./partner-services.validation";

export interface ApprovedService {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  categoryId: Types.ObjectId;
  icon?: string;
}

export interface PartnerRow {
  _id: Types.ObjectId;
  services?: Types.ObjectId[];
  serviceRadiusKm?: number;
}

export interface AreaDoc {
  partnerId: Types.ObjectId;
  baseLocation: { lat: number; lng: number; label?: string };
  cities: string[];
  areas: string[];
  radiusKm: number;
  updatedAt?: Date;
}

export const partnerServicesRepository = {
  findPartnerByUserId(userId: string) {
    return PartnerModel.findOne({ userId })
      .select("_id services serviceRadiusKm")
      .lean<PartnerRow>();
  },

  /** "Platform-approved" = an active catalog service. */
  listApproved() {
    return ServiceModel.find({ active: true })
      .select("name slug categoryId icon")
      .sort({ name: 1 })
      .lean<ApprovedService[]>();
  },

  findApprovedByIds(ids: string[]) {
    return ServiceModel.find({ _id: { $in: ids }, active: true })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
  },

  saveServices(partnerId: Types.ObjectId, ids: string[]) {
    return PartnerModel.updateOne({ _id: partnerId }, { $set: { services: ids } });
  },

  findArea(partnerId: Types.ObjectId) {
    return ServiceAreaModel.findOne({ partnerId }).lean<AreaDoc>();
  },

  /** Also mirrors the radius onto Partner.serviceRadiusKm, which other modules already read. */
  async saveArea(partnerId: Types.ObjectId, body: ServiceAreaBody): Promise<AreaDoc> {
    const doc = await ServiceAreaModel.findOneAndUpdate(
      { partnerId },
      {
        $set: {
          baseLocation: body.baseLocation,
          cities: body.cities,
          areas: body.areas,
          radiusKm: body.radiusKm,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean<AreaDoc>();
    await PartnerModel.updateOne({ _id: partnerId }, { $set: { serviceRadiusKm: body.radiusKm } });
    return doc as AreaDoc;
  },
};
