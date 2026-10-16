import http, { type ApiResponse } from "@/lib/http";

export interface ApprovedService {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  icon: string;
}

export interface PartnerServices {
  approved: ApprovedService[];
  selectedIds: string[];
}

export const getPartnerServices = async (): Promise<PartnerServices> => {
  const response = await http.get<ApiResponse<PartnerServices>>("/partner/services");
  return response.data.data;
};

export const savePartnerServices = async (
  serviceIds: string[],
): Promise<PartnerServices> => {
  const response = await http.patch<ApiResponse<PartnerServices>>("/partner/services", {
    serviceIds,
  });
  return response.data.data;
};
