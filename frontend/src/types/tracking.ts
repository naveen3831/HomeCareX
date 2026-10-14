/** Mirrors backend/src/services/TrackingService.ts. Sent over the `tracking:*` socket events. */

export interface TrackingLocation {
  /** False once the partner stops sharing; the last known position is kept. */
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  /** ISO time of the last stored fix. */
  updatedAt: string | null;
}

export interface TrackingLocationEvent extends TrackingLocation {
  bookingId: string;
}

export interface TrackingStatusEvent {
  bookingId: string;
  status: string;
  at: string;
}

/** Latest status and last known location, returned when joining (and re-joining after a reconnect). */
export interface TrackingSnapshot {
  bookingId: string;
  status: string;
  partnerAssigned: boolean;
  location: TrackingLocation;
}

export type TrackingJoinAck =
  | { ok: true; snapshot: TrackingSnapshot }
  | { ok: false; code?: string; message?: string };

export const TRACKING_JOIN_EVENT = "tracking:join";
export const TRACKING_LEAVE_EVENT = "tracking:leave";
export const TRACKING_LOCATION_EVENT = "tracking:location";
export const TRACKING_STATUS_EVENT = "tracking:status";
