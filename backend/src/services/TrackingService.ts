import { Types } from 'mongoose';
import BookingModel from '../models/Booking';
import { partnerLocationRepository } from '../modules/partner-location/partner-location.repository';
import { getIO } from '../sockets';

/** Socket events for the customer tracking screen (R06). */
export const TRACKING_LOCATION_EVENT = 'tracking:location';
export const TRACKING_STATUS_EVENT = 'tracking:status';

/** Room a customer joins (via `tracking:join`) to follow one booking. Only the booking's owner is let in. */
export const trackingRoom = (bookingId: string) => `tracking:${bookingId}`;

export interface TrackingLocation {
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
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

/** Everything the screen needs to render after a join or a reconnect. */
export interface TrackingSnapshot {
  bookingId: string;
  status: string;
  partnerAssigned: boolean;
  location: TrackingLocation;
}

const NO_LOCATION: TrackingLocation = { sharing: false, lat: null, lng: null, accuracy: null, heading: null, updatedAt: null };

export const toTrackingLocation = (doc: {
  sharing?: boolean;
  lat?: number;
  lng?: number;
  accuracy?: number;
  heading?: number;
  updatedAt?: Date;
} | null): TrackingLocation =>
  doc
    ? {
        sharing: doc.sharing ?? false,
        lat: doc.lat ?? null,
        lng: doc.lng ?? null,
        accuracy: doc.accuracy ?? null,
        heading: doc.heading ?? null,
        updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
      }
    : NO_LOCATION;

/** Emits are best effort: with sockets not initialised (tests, scripts) the data is already stored. */
const safeEmit = (bookingId: string, event: string, payload: unknown) => {
  try {
    getIO().to(trackingRoom(bookingId)).emit(event, payload);
  } catch {
    /* sockets not initialised */
  }
};

export const trackingService = {
  /** True only when the booking exists and belongs to this customer. */
  async isOwner(customerId: string, bookingId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(customerId) || !Types.ObjectId.isValid(bookingId)) return false;
    return !!(await BookingModel.exists({ _id: bookingId, customerId }));
  },

  /** Latest status + last known location, or null when the booking does not exist. */
  async snapshot(bookingId: string): Promise<TrackingSnapshot | null> {
    const booking = await BookingModel.findById(bookingId).select('status partnerId').lean<{ status: string; partnerId?: unknown }>();
    if (!booking) return null;
    const location = await partnerLocationRepository.find(bookingId);
    return {
      bookingId,
      status: booking.status,
      partnerAssigned: !!booking.partnerId,
      location: toTrackingLocation(location),
    };
  },

  emitLocation(bookingId: string, location: TrackingLocation): void {
    safeEmit(bookingId, TRACKING_LOCATION_EVENT, { bookingId, ...location } satisfies TrackingLocationEvent);
  },

  emitStatus(bookingId: string, status: string, at: Date = new Date()): void {
    safeEmit(bookingId, TRACKING_STATUS_EVENT, { bookingId, status, at: at.toISOString() } satisfies TrackingStatusEvent);
  },
};
export class TrackingService {}
export default trackingService;
