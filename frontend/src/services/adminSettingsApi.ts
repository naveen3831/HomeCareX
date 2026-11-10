import http, { type ApiResponse } from '@/lib/http';

export type SettingType = 'number' | 'integer' | 'string' | 'boolean' | 'list';
export type SettingValue = number | string | boolean | string[];

export interface AdminSetting {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  value: SettingValue;
  default: SettingValue;
  min?: number;
  max?: number;
  maxLength?: number;
  optional?: boolean;
  format?: 'email' | 'phone' | 'pincode' | 'url';
  unit?: string;
  updatedAt: string | null;
}

export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  settings: AdminSetting[];
}

export class SettingsApiError extends Error {
  constructor(message: string, public status?: number, public fields: Record<string, string> = {}) {
    super(message);
  }
}

function toError(err: unknown): SettingsApiError {
  const res = (err as { response?: { status?: number; data?: { message?: string; details?: { field: string; message: string }[] } } })?.response;
  const fields = Object.fromEntries((res?.data?.details ?? []).map((d) => [d.field, d.message]));
  // No response at all = the request never reached the API (backend stopped, proxy down, timeout).
  if (!res) return new SettingsApiError('Could not reach the server. Please check that the backend is running.', undefined, fields);
  return new SettingsApiError(res.data?.message ?? `Request failed (${res.status})`, res.status, fields);
}

/** GET /admin/settings */
export async function fetchSettings(): Promise<SettingsSection[]> {
  try {
    const { data } = await http.get<ApiResponse<{ sections: SettingsSection[] }>>('/admin/settings');
    return data.data.sections;
  } catch (err) {
    throw toError(err);
  }
}

/** PUT /admin/settings  { values: { key: value } }. Returns the refreshed sections. */
export async function saveSettings(values: Record<string, SettingValue>): Promise<SettingsSection[]> {
  try {
    const { data } = await http.put<ApiResponse<{ sections: SettingsSection[] }>>('/admin/settings', { values });
    return data.data.sections;
  } catch (err) {
    throw toError(err);
  }
}