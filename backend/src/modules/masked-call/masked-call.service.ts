import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import { partnerJobsRepository as repo } from "../partner-jobs/partner-jobs.repository";
import { getMaskedCallProvider } from "./masked-call.provider";
import { maskedCallRepository } from "./masked-call.repository";

/** Calling only makes sense while the job is live. */
const CALLABLE_STATUSES = new Set([
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
]);
const SESSION_TTL_SECONDS = 30 * 60;

export interface MaskedCallDto {
  proxyNumber: string;
  expiresAt: string;
}

export const maskedCallService = {
  /** Partner -> customer. Returns the proxy number only; real phone numbers never leave the server. */
  async startCall(
    partnerUserId: string,
    bookingId: string,
  ): Promise<MaskedCallDto> {
    const partner = await repo.findPartnerByUserId(partnerUserId);
    const booking = await repo.findBooking(bookingId);
    if (!booking)
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Booking not found");
    if (
      !partner ||
      !booking.partnerId ||
      booking.partnerId.toString() !== partner._id.toString()
    )
      throw Errors.notOwner();
    if (!CALLABLE_STATUSES.has(booking.status)) {
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "Calls are only available while the job is active",
      );
    }

    const [customer, partnerUser] = await Promise.all([
      repo.findCustomer(booking.customerId),
      maskedCallRepository.findUserPhone(partnerUserId),
    ]);
    if (!customer?.phone)
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "Customer has no phone number on file",
      );
    if (!partnerUser?.phone)
      throw Errors.conflict(
        ERROR_CODES.CONFLICT,
        "Your account has no phone number on file",
      );

    const session = await getMaskedCallProvider().createSession({
      bookingId,
      partnerPhone: partnerUser.phone,
      customerPhone: customer.phone,
      ttlSeconds: SESSION_TTL_SECONDS,
    });
    return {
      proxyNumber: session.proxyNumber,
      expiresAt: session.expiresAt.toISOString(),
    };
  },
};
