export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return (2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))) || 0;
}

export function estimateEtaMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1.3 * 60) / 25));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }

  const rounded = Number(km.toFixed(1));
  return `${rounded} km`;
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export function mapsDirectionsUrl(
  destination: LatLng | null,
  addressText: string,
): string {
  const base = "https://www.google.com/maps/dir/?api=1";

  if (destination) {
    return `${base}&destination=${destination.lat},${destination.lng}`;
  }

  return `${base}&destination=${encodeURIComponent(addressText.trim())}`;
}
