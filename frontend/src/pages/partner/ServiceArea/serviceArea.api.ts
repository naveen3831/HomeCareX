import http, { type ApiResponse } from "@/lib/http";

export interface BaseLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface PartnerServiceArea {
  baseLocation: BaseLocation | null;
  cities: string[];
  areas: string[];
  radiusKm: number;
  /** false until the partner has saved an area at least once. */
  configured: boolean;
  updatedAt: string | null;
}

export interface ServiceAreaInput {
  baseLocation: BaseLocation;
  cities: string[];
  areas: string[];
  radiusKm: number;
}

export const getServiceArea = () =>
  http.get<ApiResponse<PartnerServiceArea>>("/partner/service-area").then((r) => r.data.data);

export const saveServiceArea = (input: ServiceAreaInput) =>
  http.patch<ApiResponse<PartnerServiceArea>>("/partner/service-area", input).then((r) => r.data.data);
