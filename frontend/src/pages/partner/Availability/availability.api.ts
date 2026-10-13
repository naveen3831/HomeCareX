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

const DEFAULT_WORKING_HOURS: WorkingHoursDay[] = [
  { day: 'monday', start: '09:00', end: '18:00', off: false },
  { day: 'tuesday', start: '09:00', end: '18:00', off: false },
  { day: 'wednesday', start: '09:00', end: '18:00', off: false },
  { day: 'thursday', start: '09:00', end: '18:00', off: false },
  { day: 'friday', start: '09:00', end: '18:00', off: false },
  { day: 'saturday', start: '10:00', end: '16:00', off: false },
  { day: 'sunday', start: '09:00', end: '18:00', off: true },
];

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
    // Ignore storage quota / privacy mode errors
  }
}

export const getAvailability = async (): Promise<Availability> => {
  const storedOnline = readStoredOnlineStatus();
  try {
    const r = await http.get<ApiResponse<Availability>>('/partner/availability');
    const avail = r.data.data;
    if (storedOnline !== null && avail.isOnline !== storedOnline) {
      void http
        .patch<ApiResponse<Availability>>('/partner/availability', { isOnline: storedOnline })
        .catch(() => {});
      return { ...avail, isOnline: storedOnline };
    }
    writeStoredOnlineStatus(avail.isOnline);
    return avail;
  } catch {
    return {
      isOnline: storedOnline ?? false,
      workingHours: DEFAULT_WORKING_HOURS,
    };
  }
};

export const setOnline = async (isOnline: boolean): Promise<Availability> => {
  writeStoredOnlineStatus(isOnline);
  try {
    const r = await http.patch<ApiResponse<Availability>>('/partner/availability', { isOnline });
    const avail = r.data.data;
    writeStoredOnlineStatus(avail.isOnline);
    return avail;
  } catch {
    return {
      isOnline,
      workingHours: DEFAULT_WORKING_HOURS,
    };
  }
};

export const setWorkingHours = (workingHours: WorkingHoursDay[]) =>
  http
    .patch<ApiResponse<Availability>>('/partner/availability', { workingHours })
    .then((r) => r.data.data);