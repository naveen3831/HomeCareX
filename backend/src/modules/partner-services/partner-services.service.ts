import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import {
  partnerServicesRepository as repo,
  type AreaDoc,
} from "./partner-services.repository";
import type { ServiceAreaBody, ServicesBody } from "./partner-services.validation";

const DEFAULT_RADIUS_KM = 10;

export interface ServicesDto {
  approved: { id: string; name: string; slug: string; categoryId: string; icon: string }[];
  selectedIds: string[];
}

export interface ServiceAreaDto {
  baseLocation: { lat: number; lng: number; label: string } | null;
  cities: string[];
  areas: string[];
  radiusKm: number;
  configured: boolean;
  updatedAt: string | null;
}

async function ownPartner(userId: string) {
  const partner = await repo.findPartnerByUserId(userId);
  if (!partner) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, "Partner profile not found");
  return partner;
}

async function servicesDto(selected: { toString(): string }[] | undefined): Promise<ServicesDto> {
  const approved = await repo.listApproved();
  const approvedIds = new Set(approved.map((s) => s._id.toString()));
  return {
    approved: approved.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      slug: s.slug,
      categoryId: s.categoryId.toString(),
      icon: s.icon ?? "",
    })),
    // A service the admin later deactivates silently drops out of the partner's list.
    selectedIds: (selected ?? []).map((i) => i.toString()).filter((i) => approvedIds.has(i)),
  };
}

const areaDto = (doc: AreaDoc | null, fallbackRadius: number): ServiceAreaDto =>
  doc
    ? {
        baseLocation: {
          lat: doc.baseLocation.lat,
          lng: doc.baseLocation.lng,
          label: doc.baseLocation.label ?? "",
        },
        cities: doc.cities,
        areas: doc.areas,
        radiusKm: doc.radiusKm,
        configured: true,
        updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
      }
    : {
        baseLocation: null,
        cities: [],
        areas: [],
        radiusKm: fallbackRadius,
        configured: false,
        updatedAt: null,
      };

export const partnerServicesService = {
  async getServices(userId: string): Promise<ServicesDto> {
    const partner = await ownPartner(userId);
    return servicesDto(partner.services);
  },

  async updateServices(userId: string, body: ServicesBody): Promise<ServicesDto> {
    const partner = await ownPartner(userId);
    const found = new Set((await repo.findApprovedByIds(body.serviceIds)).map((s) => s._id.toString()));
    const rejected = body.serviceIds.filter((id) => !found.has(id));
    if (rejected.length) {
      throw Errors.validation(
        rejected.map((id) => ({
          field: "serviceIds",
          message: `Service ${id} is not platform-approved`,
        })),
      );
    }
    await repo.saveServices(partner._id, body.serviceIds);
    return servicesDto(body.serviceIds);
  },

  async getArea(userId: string): Promise<ServiceAreaDto> {
    const partner = await ownPartner(userId);
    return areaDto(await repo.findArea(partner._id), partner.serviceRadiusKm ?? DEFAULT_RADIUS_KM);
  },

  async updateArea(userId: string, body: ServiceAreaBody): Promise<ServiceAreaDto> {
    const partner = await ownPartner(userId);
    return areaDto(await repo.saveArea(partner._id, body), body.radiusKm);
  },
};
