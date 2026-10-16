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
  configured: boolean;
  updatedAt: string | null;
}

export interface ServiceAreaInput {
  baseLocation: BaseLocation;
  cities: string[];
  areas: string[];
  radiusKm: number;
}

export const getServiceArea = async (): Promise<PartnerServiceArea> => {
  const response = await http.get<ApiResponse<PartnerServiceArea>>("/partner/service-area");
  return response.data.data;
};

export const saveServiceArea = async (
  input: ServiceAreaInput,
): Promise<PartnerServiceArea> => {
  const response = await http.patch<ApiResponse<PartnerServiceArea>>("/partner/service-area", input);
  return response.data.data;
};
