
import http, { type ApiResponse } from "@/lib/http";

export const PARTNER_DESIGNATIONS = [
  "Plumber",
  "Electrician",
  "Cleaner",
  "Painter",
  "Appliance Repair",
  "Maintenance",
] as const;

export interface PartnerMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  designation?: string;
  status: "active" | "blocked";
  createdAt: string;
}

export interface CreatePartnerInput {
  name: string;
  email: string;
  designation: string;
  phone: string;
  gender: string;
  password: string;
}

/** One row of Partners & KYC directory. */
export interface PartnerDirectoryRow {
  id: string;
  partnerId: string;
  name: string;
  email: string;
  phone: string;
  kycStatus:
    | "not_started"
    | "submitted"
    | "in_review"
    | "approved"
    | "rejected"
    | "suspended";
  accountStatus: "active" | "blocked" | "invited";
  category: string;
  city: string;
  rating: number;
  ratingCount: number;
  acceptance: number;
  completion: number;
}

export interface AdminStats {
  partners: number;
  customers: number;
}

/**
 * Partner detail response.
 * Add more fields here after confirming the backend response.
 */
export interface AdminPartnerDetails {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  designation?: string;
  status?: "active" | "blocked";
  createdAt?: string;
  [key: string]: unknown;
}

export const adminApi = {
  getStats: () =>
    http
      .get<ApiResponse<AdminStats>>("/admin/partners/stats")
      .then((response) => response.data.data),

  listPartners: () =>
    http
      .get<ApiResponse<PartnerMember[]>>("/admin/partners")
      .then((response) => response.data.data),

  partnerDirectory: () =>
    http
      .get<ApiResponse<PartnerDirectoryRow[]>>(
        "/admin/partners/directory",
      )
      .then((response) => response.data.data),

  /**
   * Fetch a single partner by ID.
   * Requires a matching GET /admin/partners/:id backend endpoint.
   */
  getPartnerById: async (
    id: string,
  ): Promise<AdminPartnerDetails | null> => {
    try {
      const response = await http.get<
        ApiResponse<AdminPartnerDetails | null>
      >(`/admin/partners/${encodeURIComponent(id)}`);

      return response.data.data ?? null;
    } catch (error) {
      const status = (
        error as { response?: { status?: number } }
      )?.response?.status;

      if (status === 404) {
        return null;
      }

      throw error;
    }
  },

  createPartner: (input: CreatePartnerInput) =>
    http
      .post<
        ApiResponse<{
          partner: PartnerMember;
          emailSent: boolean;
        }>
      >("/admin/partners", input)
      .then((response) => response.data.data),
};
