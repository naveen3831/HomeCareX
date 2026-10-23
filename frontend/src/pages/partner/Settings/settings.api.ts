import axios from 'axios';
import http, { type ApiResponse } from '@/lib/http';

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'te', label: 'Telugu' },
] as const;

export type Language = (typeof LANGUAGES)[number]['value'];
export type LocationSharing = 'active_jobs' | 'online';
export type SettingsSection = 'notifications' | 'privacy' | 'security';

export interface PartnerSettings {
  language: Language;
  notifications: { push: boolean; sms: boolean; email: boolean; jobAlerts: boolean; promotions: boolean };
  privacy: { locationSharing: LocationSharing; allowCalls: boolean; allowChat: boolean };
  security: { loginAlerts: boolean };
  updatedAt: string | null;
}

// The shared http client adds the access token and uses the /api/v1 base URL.
export const settingsApi = {
  /** GET /partner/settings */
  get: (signal?: AbortSignal) =>
    http.get<ApiResponse<PartnerSettings>>('/partner/settings', { signal }).then((r) => r.data.data),

  /** PATCH /partner/settings/notifications | /privacy | /security */
  patchSection: (section: SettingsSection, body: Record<string, boolean | string>) =>
    http.patch<ApiResponse<PartnerSettings>>(`/partner/settings/${section}`, body).then((r) => r.data.data),

  /** PATCH /partner/settings { language } */
  patchLanguage: (language: Language) =>
    http.patch<ApiResponse<PartnerSettings>>('/partner/settings', { language }).then((r) => r.data.data),
};

export function settingsErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have access to these settings.';
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (!err.response) return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}