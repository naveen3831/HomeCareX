import { getIOIfReady, rooms } from "../sockets";

export interface TrackingLocation {
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  updatedAt: string | null;
}

export const trackingService = {
  emitLocation(bookingId: string, location: TrackingLocation): void {
    getIOIfReady()
      ?.to(rooms.tracking(bookingId))
      .emit("tracking:location", { bookingId, ...location });
  },

  emitStatus(bookingId: string, status: string, at: Date = new Date()): void {
    getIOIfReady()
      ?.to(rooms.tracking(bookingId))
      .emit("tracking:status", { bookingId, status, at: at.toISOString() });
  },
};
