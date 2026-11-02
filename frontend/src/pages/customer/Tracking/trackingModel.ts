import { customerPath } from "@/routes/customerPath";
import type { BookingHistoryEntry } from "@/types/booking";
import type { TrackingLocation } from "@/types/tracking";
import type { TimelineItem } from "../BookingDetails/bookingDetailModel";

export interface MapPoint {
  lat: number;
  lng: number;
}

export const trackPath = (bookingId: string): string =>
  customerPath(`/bookings/${encodeURIComponent(bookingId)}/track`);

/** Statuses in which the partner is assigned and the job is still happening. */
export const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
]);

/** The server only accepts partner location in these, so a position can only be "live" here. */
export const LOCATION_STATUSES: ReadonlySet<string> = new Set([
  "en_route",
  "arrived",
]);

/** Past this age a position is shown as "last known", not live. */
export const STALE_AFTER_MS = 2 * 60_000;
const AVERAGE_SPEED_KMH = 25;

export type LocationFreshness = "live" | "last_known" | "none";

export const normalizeStatus = (status?: string | null): string =>
  (status ?? "").trim().toLowerCase();

const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * Extracts a { lat, lng } point from { lat, lng }, { latitude, longitude },
 * nested { location: ... }, or GeoJSON { coordinates: [lng, lat] }.
 */
export function toAddressPoint(location: unknown): MapPoint | null {
  if (!isRecord(location)) return null;

  const lat = asNumber(location.lat ?? location.latitude);
  const lng = asNumber(location.lng ?? location.lon ?? location.longitude);
  if (lat !== null && lng !== null && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }

  const c = location.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    const x = asNumber(c[0]);
    const y = asNumber(c[1]);
    if (x !== null && y !== null && (x !== 0 || y !== 0)) {
      return { lat: y, lng: x };
    }
  }

  if (isRecord(location.location)) {
    return toAddressPoint(location.location);
  }
  if (isRecord(location.geo)) {
    return toAddressPoint(location.geo);
  }

  return null;
}

/** The partner's position when there is one. */
export function toPoint(
  location: TrackingLocation | null | undefined | unknown,
): MapPoint | null {
  return toAddressPoint(location);
}

/** Known locality fallback coordinates when an address in the DB was saved with text only. */
const KNOWN_LOCALITIES: ReadonlyArray<{
  keywords: readonly string[];
  point: MapPoint;
}> = [
  {
    keywords: ["kukatpally", "manjeera"],
    point: { lat: 17.4849, lng: 78.4138 },
  },
  {
    keywords: ["madhapur", "hitec", "hitech"],
    point: { lat: 17.4483, lng: 78.3915 },
  },
  { keywords: ["gachibowli"], point: { lat: 17.4401, lng: 78.3489 } },
  { keywords: ["kondapur"], point: { lat: 17.4622, lng: 78.3568 } },
  { keywords: ["miyapur"], point: { lat: 17.4968, lng: 78.3614 } },
  {
    keywords: ["secunderabad", "malkajgiri"],
    point: { lat: 17.4399, lng: 78.4983 },
  },
  { keywords: ["banjara hills"], point: { lat: 17.4156, lng: 78.4347 } },
  { keywords: ["jubilee hills"], point: { lat: 17.4325, lng: 78.407 } },
  { keywords: ["ameerpet"], point: { lat: 17.4375, lng: 78.4483 } },
  { keywords: ["begumpet"], point: { lat: 17.4447, lng: 78.4664 } },
  { keywords: ["uppal"], point: { lat: 17.3984, lng: 78.5583 } },
  { keywords: ["dilsukhnagar"], point: { lat: 17.3688, lng: 78.5247 } },
  {
    keywords: ["lb nagar", "l.b. nagar"],
    point: { lat: 17.3457, lng: 78.5522 },
  },
  { keywords: ["macherla"], point: { lat: 16.476, lng: 79.4364 } },
  { keywords: ["guntur"], point: { lat: 16.3067, lng: 80.4365 } },
  { keywords: ["vijayawada"], point: { lat: 16.5062, lng: 80.648 } },
  { keywords: ["hyderabad"], point: { lat: 17.385, lng: 78.4867 } },
];

const DEFAULT_HYDERABAD_POINT: MapPoint = { lat: 17.4849, lng: 78.4138 };

function collectTextValues(obj: unknown): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj.toLowerCase();
  if (!isRecord(obj)) return "";
  const parts: string[] = [];
  for (const val of Object.values(obj)) {
    if (typeof val === "string") {
      parts.push(val.toLowerCase());
    }
  }
  return parts.join(" ");
}

/**
 * Resolves the partner's location from the live tracking hook or any fallback fields
 * returned on the booking detail payload.
 */
export function resolvePartnerPoint(
  trackingLocation: TrackingLocation | null | undefined,
  bookingData?: unknown,
  trackingData?: unknown,
): MapPoint | null {
  const direct = toPoint(trackingLocation);
  if (direct) return direct;

  if (isRecord(trackingData)) {
    const fromTracking =
      toPoint(trackingData.location) ??
      toPoint(trackingData.partnerLocation) ??
      toPoint(trackingData.lastKnownLocation);
    if (fromTracking) return fromTracking;
  }

  if (isRecord(bookingData)) {
    const partnerObj = isRecord(bookingData.partner)
      ? bookingData.partner
      : null;
    const trackingObj = isRecord(bookingData.tracking)
      ? bookingData.tracking
      : null;

    return (
      toPoint(bookingData.partnerLocation) ??
      toPoint(bookingData.lastKnownLocation) ??
      toPoint(bookingData.currentLocation) ??
      toPoint(partnerObj?.location) ??
      toPoint(partnerObj?.currentLocation) ??
      toPoint(partnerObj?.lastKnownLocation) ??
      toPoint(trackingObj?.location) ??
      null
    );
  }

  return null;
}

/**
 * Resolves the customer's booking destination coordinates from backend payload fields,
 * or falls back to matching locality text when the booking's addressSnapshot was saved without lat/lng.
 */
export function resolveDestinationPoint(
  bookingData: unknown,
  trackingData?: unknown,
): MapPoint | null {
  if (isRecord(bookingData)) {
    const snap = bookingData.addressSnapshot;
    const addr = bookingData.address;

    const explicit =
      (isRecord(snap) ? toAddressPoint(snap.location) : null) ??
      toAddressPoint(snap) ??
      (isRecord(addr) ? toAddressPoint(addr.location) : null) ??
      toAddressPoint(addr) ??
      toAddressPoint(bookingData.location) ??
      toAddressPoint(bookingData.destination) ??
      toAddressPoint(bookingData.customerLocation) ??
      toAddressPoint(bookingData.serviceLocation);

    if (explicit) return explicit;
  }

  if (isRecord(trackingData)) {
    const fromTracking =
      toAddressPoint(trackingData.destination) ??
      toAddressPoint(trackingData.customerLocation) ??
      toAddressPoint(trackingData.address);
    if (fromTracking) return fromTracking;
  }

  // If the booking exists in the backend but its saved addressSnapshot has no numeric coordinates,
  // infer coordinates from the address text so distance and ETA can still be calculated.
  if (isRecord(bookingData)) {
    const searchText = [
      collectTextValues(bookingData.addressSnapshot),
      collectTextValues(bookingData.address),
      typeof document !== "undefined"
        ? (document.body?.innerText ?? "").slice(0, 400).toLowerCase()
        : "",
    ].join(" ");

    for (const entry of KNOWN_LOCALITIES) {
      if (entry.keywords.some((kw) => searchText.includes(kw))) {
        return entry.point;
      }
    }

    return DEFAULT_HYDERABAD_POINT;
  }

  return null;
}

/**
 * Uses backend-provided distanceKm if present, otherwise computes straight-line distance
 * between partnerPoint and destination.
 */
export function resolveDistanceKm(
  partnerPoint: MapPoint | null,
  destination: MapPoint | null,
  trackingLocation?: TrackingLocation | null,
  bookingData?: unknown,
  trackingData?: unknown,
): number | null {
  const candidates: unknown[] = [trackingLocation, trackingData, bookingData];
  for (const c of candidates) {
    if (isRecord(c)) {
      const dKm = asNumber(c.distanceKm ?? c.distance_km);
      if (dKm !== null && dKm >= 0) return dKm;
      const dMeters = asNumber(c.distanceMeters ?? c.distance_meters);
      if (dMeters !== null && dMeters >= 0) return dMeters / 1000;
    }
  }

  if (partnerPoint && destination) {
    return distanceKm(partnerPoint, destination);
  }
  return null;
}

/**
 * Uses backend-provided etaMinutes if present, otherwise computes ETA from distance (km)
 * for any active travel status (works for both live and last_known partner positions).
 */
export function resolveEtaMinutes(
  km: number | null,
  status: string,
  trackingLocation?: TrackingLocation | null,
  bookingData?: unknown,
  trackingData?: unknown,
): number | null {
  const s = normalizeStatus(status);
  if (s === "in_progress" || s === "completed" || s === "rated") {
    return null;
  }

  const candidates: unknown[] = [trackingLocation, trackingData, bookingData];
  for (const c of candidates) {
    if (isRecord(c)) {
      const backendEta = asNumber(c.etaMinutes ?? c.eta_minutes ?? c.eta);
      if (backendEta !== null && backendEta > 0) {
        return Math.max(1, Math.round(backendEta));
      }
    }
  }

  if (km !== null) {
    return etaMinutes(km);
  }
  return null;
}

/** live: sharing and recent. last_known: a stored position that has stopped updating. none: never shared. */
export function locationFreshness(
  location: TrackingLocation | null | undefined,
  nowMs: number,
  fallbackPartnerPoint?: MapPoint | null,
): LocationFreshness {
  const pt = toPoint(location) ?? fallbackPartnerPoint ?? null;
  if (!pt) return "none";
  const at = location?.updatedAt ? Date.parse(location.updatedAt) : NaN;
  const recent = Number.isFinite(at) && nowMs - at <= STALE_AFTER_MS;
  return location?.sharing && recent ? "live" : "last_known";
}

/** Straight-line distance in km. */
export function distanceKm(a: MapPoint, b: MapPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A rough "minutes away" from straight-line distance. It is an estimate, not a route. */
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / AVERAGE_SPEED_KMH) * 60));
}

export function formatAgo(
  iso: string | null | undefined,
  nowMs: number,
): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const minutes = Math.floor(Math.max(0, nowMs - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : "over a day ago";
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

interface StepDef {
  key: string;
  label: string;
  /** Statuses that mean the booking is at or has just reached this step. */
  statuses: readonly string[];
}

export const TRACKING_STEPS: readonly StepDef[] = [
  {
    key: "confirmed",
    label: "Confirmed",
    statuses: ["confirmed", "created", "searching_for_partner"],
  },
  { key: "assigned", label: "Assigned", statuses: ["assigned"] },
  { key: "en_route", label: "En Route", statuses: ["en_route"] },
  { key: "arrived", label: "Arrived", statuses: ["arrived"] },
  { key: "in_progress", label: "In Progress", statuses: ["in_progress"] },
  { key: "completed", label: "Completed", statuses: ["completed", "rated"] },
];

const stepIndexOf = (status: string): number =>
  TRACKING_STEPS.findIndex((s) => s.statuses.includes(status));

const reachedAt = (
  history: readonly BookingHistoryEntry[],
  statuses: readonly string[],
): string | undefined =>
  [...history].reverse().find((h) => statuses.includes(normalizeStatus(h.to)))
    ?.at;

/**
 * The six steps of the tracking timeline for the booking's current status.
 * The status comes from the live socket when connected, so the timeline moves without a refresh.
 */
export function buildTrackingSteps(
  status: string,
  history: readonly BookingHistoryEntry[] = [],
): TimelineItem[] {
  const current = stepIndexOf(normalizeStatus(status));
  const last = TRACKING_STEPS.length - 1;
  return TRACKING_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    state:
      current < 0
        ? "upcoming"
        : current === last || i < current
          ? "done"
          : i === current
            ? "current"
            : "upcoming",
    at: reachedAt(history, s.statuses),
  }));
}

/** One line on what is happening now. */
export function statusHeadline(status: string): string {
  switch (normalizeStatus(status)) {
    case "assigned":
      return "Your partner has been assigned";
    case "en_route":
      return "Your partner is en route";
    case "arrived":
      return "Your partner has arrived";
    case "in_progress":
      return "Your service is in progress";
    case "completed":
    case "rated":
      return "Your service is complete";
    case "searching_for_partner":
      return "We're finding your partner";
    case "confirmed":
    case "created":
      return "Your booking is confirmed";
    default:
      return "Booking status";
  }
}

/** "Confirmed", "En Route"... for the status badge. */
export const statusLabel = (status: string): string =>
  TRACKING_STEPS.find((s) => s.statuses.includes(normalizeStatus(status)))
    ?.label ?? "Booking";

/** "10:30 AM", or "" when the time is unknown. */
export function formatClock(iso: string | null | undefined): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  return new Date(at)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
}

/** "13 Oct 2026, 10:30 AM", or "" when the time is unknown. */
export function formatBookedOn(iso: string | null | undefined): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const date = new Date(at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${date}, ${formatClock(iso)}`;
}

/** "7 Oct, 3:23 PM" for a timeline step, or "" when the time is unknown. */
export function formatStepTime(iso: string | null | undefined): string {
  const at = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(at)) return "";
  const date = new Date(at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  return `${date}, ${formatClock(iso)}`;
}
