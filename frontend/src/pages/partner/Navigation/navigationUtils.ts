export type LatLng = { lat: number; lng: number };

export const haversineKm = (a: LatLng, b: LatLng): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

export const formatEta = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
};

export const estimateEtaMinutes = (km: number): number =>
  Math.max(1, Math.round((km / 25) * 60));

export const buildGoogleMapsNavigationUrl = (
  destination: LatLng | null,
  fallbackAddress?: string,
): string | null => {
  const point = destination &&
    Number.isFinite(destination.lat) &&
    Number.isFinite(destination.lng) &&
    destination.lat >= -90 &&
    destination.lat <= 90 &&
    destination.lng >= -180 &&
    destination.lng <= 180
    ? { lat: destination.lat, lng: destination.lng }
    : null;
  const target = point ? `${point.lat},${point.lng}` : (fallbackAddress ?? "").trim();
  if (!target) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("destination", target);
  url.searchParams.set("dir_action", "navigate");
  if (point) {
    url.searchParams.set("destination", `${point.lat},${point.lng}`);
  }
  return url.toString();
};
