import http, { type ApiResponse } from '@/lib/http';

/** What the public website footer shows. Edited by admins under Settings (Business, Support, Social links). */
export interface SiteSettings {
  phone: string;
  email: string;
  hours: string;
  country: string;
  social: { facebook: string; instagram: string; x: string; linkedin: string };
}

/** GET /site-settings: public, no login. */
export async function fetchSiteSettings(): Promise<SiteSettings> {
  const res = await http.get<ApiResponse<SiteSettings>>('/site-settings');
  return res.data.data;
}