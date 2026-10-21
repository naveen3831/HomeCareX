import http, { type ApiResponse } from '@/lib/http';

export interface InviteInfo {
  name: string;
  email: string;
}

export interface AcceptInviteResult {
  email: string;
  message: string;
}

/** POST /auth/verify-invite: who the invite link is for (also rejects expired / used links). */
export async function verifyInvite(token: string): Promise<InviteInfo> {
  const res = await http.post<ApiResponse<InviteInfo>>('/auth/verify-invite', { token });
  return res.data.data;
}

/** POST /auth/accept-invite: sets the password and activates the account. */
export async function acceptInvite(token: string, password: string): Promise<AcceptInviteResult> {
  const res = await http.post<ApiResponse<AcceptInviteResult>>('/auth/accept-invite', { token, password });
  return res.data.data;
}
