import http, { type ApiResponse } from "@/lib/http";

export type SkillRequestStatus = "pending" | "approved" | "rejected";

export interface SkillRequest {
  id: string;
  name: string;
  status: SkillRequestStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PartnerSkills {
  /** Skills chosen when joining, plus any the admin approved later. */
  skills: string[];
  /** Waiting for approval, or rejected. Approved ones are already in `skills`. */
  requests: SkillRequest[];
}

export const getPartnerSkills = async (): Promise<PartnerSkills> => {
  const response = await http.get<ApiResponse<PartnerSkills>>("/partner/skills");
  return response.data.data;
};

/** Asks the admin to add a new skill. It shows as "Pending approval" until they decide. */
export const requestPartnerSkill = async (name: string): Promise<SkillRequest> => {
  const response = await http.post<ApiResponse<SkillRequest>>("/partner/skills", { name });
  return response.data.data;
};
