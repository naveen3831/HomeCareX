import type { PartnerServiceArea, ServiceAreaInput } from "./serviceArea.api";

export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;
export const MAX_CITIES = 20;
export const MAX_AREAS = 50;

export interface AreaForm {
  label: string;
  lat: string;
  lng: string;
  cities: string[];
  areas: string[];
  radius: string;
}

export interface AreaErrors {
  baseLocation?: string;
  cities?: string;
  radiusKm?: string;
}

export const emptyForm = (radius = 10): AreaForm => ({
  label: "",
  lat: "",
  lng: "",
  cities: [],
  areas: [],
  radius: String(radius),
});

export const toForm = (area: PartnerServiceArea): AreaForm => ({
  label: area.baseLocation?.label ?? "",
  lat: area.baseLocation ? String(area.baseLocation.lat) : "",
  lng: area.baseLocation ? String(area.baseLocation.lng) : "",
  cities: area.cities,
  areas: area.areas,
  radius: String(area.radiusKm),
});

const num = (text: string): number | null => {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

/** Mirrors the backend rules so the partner sees problems before saving. */
export function validateForm(form: AreaForm): AreaErrors {
  const errors: AreaErrors = {};
  const lat = num(form.lat);
  const lng = num(form.lng);
  if (lat === null || lng === null) errors.baseLocation = "Set your base location (latitude and longitude).";
  else if (lat < -90 || lat > 90) errors.baseLocation = "Latitude must be between -90 and 90.";
  else if (lng < -180 || lng > 180) errors.baseLocation = "Longitude must be between -180 and 180.";

  if (form.cities.length === 0) errors.cities = "Add at least one city you serve.";

  const radius = num(form.radius);
  if (radius === null) errors.radiusKm = "Enter a radius in km.";
  else if (!Number.isInteger(radius)) errors.radiusKm = "Radius must be a whole number.";
  else if (radius < MIN_RADIUS_KM || radius > MAX_RADIUS_KM)
    errors.radiusKm = `Radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km.`;
  return errors;
}

export const hasErrors = (errors: AreaErrors): boolean => Object.keys(errors).length > 0;

/** Only call after validateForm returned no errors. */
export const toInput = (form: AreaForm): ServiceAreaInput => ({
  baseLocation: { lat: Number(form.lat), lng: Number(form.lng), label: form.label.trim() },
  cities: form.cities,
  areas: form.areas,
  radiusKm: Number(form.radius),
});

/** Adds a trimmed entry unless it is too short, a duplicate (any case) or over the limit. */
export function addEntry(list: string[], raw: string, max: number): { list: string[]; error?: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 2) return { list, error: "Enter at least 2 characters." };
  if (value.length > 80) return { list, error: "Keep it under 80 characters." };
  if (list.some((x) => x.toLowerCase() === value.toLowerCase())) return { list, error: `${value} is already added.` };
  if (list.length >= max) return { list, error: `You can add at most ${max}.` };
  return { list: [...list, value] };
}

export const sameForm = (a: AreaForm, b: AreaForm): boolean => JSON.stringify(a) === JSON.stringify(b);
