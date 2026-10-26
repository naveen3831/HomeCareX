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

/**
 * The shared client may hand back a raw axios error or its own normalised error
 * ({ status, code, message }), so the status is read from either shape.
 */
export function settingsErrorMessage(err: unknown): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as {
    response?: { status?: number; data?: { message?: unknown } };
    status?: number;
    statusCode?: number;
    message?: unknown;
  };

  const status = e.response?.status ?? e.status ?? e.statusCode;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have access to these settings.';

  const serverMessage = e.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;

  if (typeof status === 'number' && status >= 400) {
    return typeof e.message === 'string' && e.message.trim() ? e.message : 'Something went wrong. Please try again.';
  }

  if (axios.isAxiosError(err) && !err.response) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}