import http, { type ApiResponse } from '@/lib/http';

export type SkillRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminSkillRequest {
  id: string;
  name: string;
  status: SkillRequestStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  partnerId: string;
  partnerName: string | null;
  partnerPhone: string | null;
  currentSkills: string[];
}

export const fetchSkillRequests = async (status: SkillRequestStatus): Promise<AdminSkillRequest[]> => {
  const { data } = await http.get<ApiResponse<AdminSkillRequest[]>>('/admin/skill-requests', { params: { status } });
  return data.data ?? [];
};

export const reviewSkillRequest = async (id: string, decision: 'approve' | 'reject', note?: string): Promise<void> => {
  await http.post(`/admin/skill-requests/${encodeURIComponent(id)}/${decision}`, note ? { note } : {});
};
