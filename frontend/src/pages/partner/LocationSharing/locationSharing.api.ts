import api from '@/lib/api';

/** Mirrors backend LocationDto (partner-location.service.ts). */
export interface LocationState {
  bookingId: string;
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  updatedAt: string | null;
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
}

export async function fetchLocation(jobId: string): Promise<LocationState> {
  const res = await api.get<{ data: LocationState }>(`/partner/jobs/${jobId}/location`);
  return res.data.data;
}

export async function sendLocation(jobId: string, fix: Fix): Promise<LocationState> {
  const res = await api.patch<{ data: LocationState }>(`/partner/jobs/${jobId}/location`, fix);
  return res.data.data;
}

export async function stopLocation(jobId: string): Promise<LocationState> {
  const res = await api.delete<{ data: LocationState }>(`/partner/jobs/${jobId}/location`);
  return res.data.data;
}