import http, { type ApiResponse } from '@/lib/http';

export interface WorkingHoursDay {
  day: string;
  start: string;
  end: string;
  off: boolean;
}

export interface Availability {
  isOnline: boolean;
  workingHours: WorkingHoursDay[];
}

export const PARTNER_ONLINE_STORAGE_KEY = 'homecarex_partner_online_status';

export function readStoredOnlineStatus(): boolean | null {
  try {
    const raw = window.localStorage.getItem(PARTNER_ONLINE_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredOnlineStatus(isOnline: boolean): void {
  try {
    window.localStorage.setItem(PARTNER_ONLINE_STORAGE_KEY, String(isOnline));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export const getAvailability = () =>
  http.get<ApiResponse<Availability>>('/partner/availability').then((r) => r.data.data);

export const setOnline = (isOnline: boolean) =>
  http
    .patch<ApiResponse<Availability>>('/partner/availability', { isOnline })
    .then((r) => r.data.data);

export const setWorkingHours = (workingHours: WorkingHoursDay[]) =>
  http
    .patch<ApiResponse<Availability>>('/partner/availability', { workingHours })
    .then((r) => r.data.data);