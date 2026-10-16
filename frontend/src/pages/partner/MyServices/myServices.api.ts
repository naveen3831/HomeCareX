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

export const getPartnerServices = () =>
  http.get<ApiResponse<PartnerServices>>("/partner/services").then((r) => r.data.data);

export const savePartnerServices = (serviceIds: string[]) =>
  http.patch<ApiResponse<PartnerServices>>("/partner/services", { serviceIds }).then((r) => r.data.data);
