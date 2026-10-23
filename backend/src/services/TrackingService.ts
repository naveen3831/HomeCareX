import { getIOIfReady } from '../sockets';

export const trackingRoom = (bookingId: string) => `tracking:${bookingId}`;

export class TrackingService {
  emitLocation(bookingId: string, location: object): void {
    getIOIfReady()?.to(trackingRoom(bookingId)).emit('tracking:location', {
      bookingId,
      ...location,
    });
  }

  emitStatus(bookingId: string, status: string, updatedAt = new Date()): void {
    getIOIfReady()?.to(trackingRoom(bookingId)).emit('tracking:status', {
      bookingId,
      status,
      updatedAt: updatedAt.toISOString(),
    });
  }
}

export const trackingService = new TrackingService();
