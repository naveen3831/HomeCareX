import type { Types } from "mongoose";
import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import { emitToBooking } from "../../sockets";
import { trackingService } from "../../services/TrackingService";
import { partnerJobsRepository as jobs } from "../partner-jobs/partner-jobs.repository";
import {
  partnerLocationRepository as repo,
  type LocationDoc,
} from "./partner-location.repository";
import type { LocationBody } from "./partner-location.validation";

export const LOCATION_UPDATE_EVENT = "partner:location_update";

/** Location can only be shared while the partner is travelling to or working at the customer. */
const SHARING_STATUSES = new Set(["en_route", "arrived", "in_progress"]);

export interface LocationDto {
  bookingId: string;
  sharing: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  updatedAt: string | null;
}

export const locationNotifier = {
  update(bookingId: string, dto: LocationDto): void {
    try {
      // Booking rooms are authorization-protected (customer / assigned partner / admin only).
      emitToBooking(bookingId, LOCATION_UPDATE_EVENT, dto);
    } catch {
      /* sockets not initialised (tests / scripts); the position is already stored */
    }
    // Customer tracking room (R06). Emits are best effort and never throw.
    trackingService.emitLocation(bookingId, dto);
  },
};

const toDto = (bookingId: string, doc: LocationDoc | null): LocationDto => ({
  bookingId,
  sharing: doc?.sharing ?? false,
  lat: doc?.lat ?? null,
  lng: doc?.lng ?? null,
  accuracy: doc?.accuracy ?? null,
  heading: doc?.heading ?? null,
  updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
});

/** 404 for a missing booking, 403 when it is not this partner's job. */
async function ownJob(
  userId: string,
  bookingId: string,
): Promise<{
  bookingObjectId: Types.ObjectId;
  partnerId: Types.ObjectId;
  status: string;
}> {
  const [partner, booking] = await Promise.all([
    jobs.findPartnerByUserId(userId),
    jobs.findBooking(bookingId),
  ]);
  if (!booking)
    throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Booking not found");
  if (
    !partner ||
    !booking.partnerId ||
    booking.partnerId.toString() !== partner._id.toString()
  )
    throw Errors.notOwner();
  return {
    bookingObjectId: booking._id,
    partnerId: partner._id,
    status: booking.status,
  };
}

export const partnerLocationService = {
  async update(
    userId: string,
    bookingId: string,
    body: LocationBody,
  ): Promise<LocationDto> {
    const { bookingObjectId, partnerId, status } = await ownJob(
      userId,
      bookingId,
    );
    if (!SHARING_STATUSES.has(status)) {
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "Location can only be shared while the job is active",
      );
    }
    const saved = await repo.save(bookingObjectId, partnerId, body);
    const dto = toDto(bookingId, saved);
    locationNotifier.update(bookingId, dto);
    return dto;
  },

  async get(userId: string, bookingId: string): Promise<LocationDto> {
    await ownJob(userId, bookingId);
    return toDto(bookingId, await repo.find(bookingId));
  },

  /** Idempotent: stopping when nothing is being shared simply returns the not-sharing state. */
  async stop(userId: string, bookingId: string): Promise<LocationDto> {
    const { partnerId } = await ownJob(userId, bookingId);
    const dto = toDto(bookingId, await repo.stop(bookingId, partnerId));
    locationNotifier.update(bookingId, dto);
    return dto;
  },
};
