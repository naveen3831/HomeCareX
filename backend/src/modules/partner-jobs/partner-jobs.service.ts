import type { Types } from "mongoose";
import { ERROR_CODES } from "../../constants/errorCodes";
import { HttpError } from "../auth/auth.types";
import { Errors, httpError } from "../../utils/errors";
import type { BookingStatus } from "../bookings/bookings.constants";
import { applyTransition } from "../bookings/bookings.stateMachine";
import { ensurePartnerProfile } from "../partners/partners.service";
import {
  partnerJobsRepository as repo,
  type JobBookingDoc,
} from "./partner-jobs.repository";
import { isPartnerTarget } from "./partner-jobs.validation";
import type {
  JobActionDto,
  JobAddOnDto,
  JobChecklistItemDto,
  JobDetailDto,
  JobListItemDto,
  JobRequestDto,
} from "./partner-jobs.types";

const money = (n: number): number => Math.round(n * 100) / 100;

/** "Rahul Kumar" -> "Rahul K." The partner never needs the full surname. */
export const maskName = (name?: string): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

/** "+919876543210" -> "******3210" */
export const maskPhone = (phone?: string): string | null => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `${"*".repeat(6)}${digits.slice(-4)}`;
};

/** Buttons the partner may press right now. Order follows the lifecycle. */
export const actionsFor = (status: BookingStatus): JobActionDto[] => {
  if (status === "assigned")
    return [{ status: "en_route", label: "On the way" }];
  if (status === "en_route") return [{ status: "arrived", label: "Arrived" }];
  return [];
};

const toChecklist = (
  booking: JobBookingDoc,
  inclusions: string[],
): JobChecklistItemDto[] => {
  if (booking.checklist && booking.checklist.length > 0) {
    return booking.checklist.map((c) => ({
      id: c.id,
      label: c.label,
      done: c.done,
    }));
  }
  return inclusions.map((label, i) => ({
    id: `inc-${i + 1}`,
    label,
    done: false,
  }));
};

const toAddOns = (
  booking: JobBookingDoc,
  catalog: Array<{ _id: Types.ObjectId; name: string; price: number }>,
): JobAddOnDto[] => {
  const fromSnapshot = (booking.priceSnapshot?.lines ?? []).filter(
    (l) => l.kind === "ADDON",
  );
  if (fromSnapshot.length > 0) {
    return fromSnapshot.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      amount: money(l.amount),
    }));
  }
  return booking.addOns.flatMap((a) => {
    const found = catalog.find(
      (c) => c._id.toString() === a.addOnId.toString(),
    );
    return found
      ? [
          {
            name: found.name,
            quantity: a.quantity,
            amount: money(found.price * a.quantity),
          },
        ]
      : [];
  });
};

async function getPartnerProfile(userId: string) {
  let partner = await repo.findPartnerByUserId(userId);
  if (!partner) {
    try {
      const created = await ensurePartnerProfile(userId);
      if (created) {
        partner = { _id: created._id };
      }
    } catch {
      // ignore
    }
  }
  return partner;
}

/** Loads the booking and proves it belongs to the signed-in partner. */
async function loadOwnedBooking(userId: string, bookingId: string) {
  const partner = await repo.findPartnerByUserId(userId);
  if (!partner)
    throw Errors.notFound(
      ERROR_CODES.PARTNER_NOT_FOUND,
      "No partner profile found for this account",
    );
  const booking = await repo.findBooking(bookingId);
  if (!booking)
    throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
  if (
    !booking.partnerId ||
    booking.partnerId.toString() !== partner._id.toString()
  )
    throw Errors.notOwner();
  return { partner, booking };
}

async function buildDetail(booking: JobBookingDoc): Promise<JobDetailDto> {
  const [customer, service] = await Promise.all([
    repo.findCustomer(booking.customerId),
    booking.serviceId
      ? repo.findService(booking.serviceId)
      : Promise.resolve(null),
  ]);
  const coords = booking.address.location?.coordinates;
  return {
    id: booking._id.toString(),
    status: booking.status,
    customer: {
      name: maskName(customer?.name ?? booking.customerName),
      phone: maskPhone(customer?.phone),
    },
    service: {
      name: booking.serviceName,
      quantity: booking.quantity,
      durationMinutes: service?.durationMinutes ?? null,
    },
    location: {
      line1: booking.address.line1,
      area: booking.address.area ?? null,
      city: booking.address.city,
      pincode: booking.address.pincode ?? null,
      coordinates:
        coords && coords.length === 2
          ? { lat: coords[1], lng: coords[0] }
          : null,
    },
    schedule: {
      scheduledAt: booking.scheduledAt.toISOString(),
      date: booking.date ?? null,
      slot: booking.slot ?? null,
      startedAt: booking.startedAt ? booking.startedAt.toISOString() : null,
    },
    price: {
      currency: booking.priceSnapshot?.currency ?? "INR",
      total: money(booking.priceBreakdown?.total ?? 0),
      partnerEarning: money(booking.partnerEarning ?? 0),
    },
    addOns: toAddOns(booking, service?.addOns ?? []),
    instructions: booking.instructions ?? null,
    checklist: toChecklist(booking, service?.inclusions ?? []),
    payment: {
      status: booking.paymentStatus,
      paidAt: booking.paymentDetails?.paidAt
        ? booking.paymentDetails.paidAt.toISOString()
        : null,
    },
    actions: actionsFor(booking.status),
    otpRequired: booking.status === "arrived",
    statusHistory: booking.statusHistory.map((h) => ({
      from: h.from,
      to: h.to,
      at: h.at.toISOString(),
      actorRole: h.actorRole,
      actorId: h.actorId ?? null,
      reason: h.reason ?? null,
    })),
  };
}

const invalid = (message: string): HttpError =>
  httpError(422, ERROR_CODES.INVALID_STATE_TRANSITION, message);

/** Statuses in which navigation, chat and a masked call make sense. */
const LIVE_STATUSES: BookingStatus[] = [
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
];

export const partnerJobsService = {
  /** GET /partner/jobs. The signed-in partner's live jobs, straight from the bookings collection. */
  async listLiveJobs(userId: string): Promise<JobListItemDto[]> {
    const partner = await repo.findPartnerByUserId(userId);
    if (!partner)
      throw Errors.notFound(
        ERROR_CODES.PARTNER_NOT_FOUND,
        "No partner profile found for this account",
      );
    const rows = await repo.listLiveForPartner(partner._id, LIVE_STATUSES);
    return rows.map((b) => ({
      id: b._id.toString(),
      status: b.status,
      service: { name: b.serviceName },
      customerName: maskName(b.customerName),
      address: [b.address.line1, b.address.area, b.address.city]
        .filter(Boolean)
        .join(", "),
      scheduledAt: b.scheduledAt.toISOString(),
      slot: b.slot ?? null,
      partnerEarning: money(b.partnerEarning ?? 0),
    }));
  },

  /** GET /partner/jobs/:id. Own jobs only. */
  async getJob(userId: string, bookingId: string): Promise<JobDetailDto> {
    const { booking } = await loadOwnedBooking(userId, bookingId);
    return buildDetail(booking);
  },

  /** GET /partner/job-requests. List pending unexpired offers for this partner. */
  async listRequests(userId: string, now: Date = new Date()): Promise<JobRequestDto[]> {
    const partner = await getPartnerProfile(userId);
    if (!partner) {
      throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
    }
    const bookings = await repo.findJobRequests(partner._id, now);
    return bookings.map((b) => {
      const offer = b.offers?.find(
        (o) => o.partnerId.toString() === partner._id.toString() && o.response === 'pending',
      );
      const expiresAt = offer?.expiresAt
        ? offer.expiresAt.toISOString()
        : new Date(now.getTime() + 15 * 60_000).toISOString();
      return {
        id: b._id.toString(),
        service: b.serviceName,
        area: b.address.area || b.address.city,
        price: money(b.partnerEarning || b.priceBreakdown?.total || 0),
        scheduledAt: b.scheduledAt.toISOString(),
        expiresAt,
      };
    });
  },

  /** POST /partner/jobs/:id/accept */
  async acceptOffer(userId: string, bookingId: string, now: Date = new Date()) {
    const partner = await getPartnerProfile(userId);
    if (!partner) {
      throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
    }
    const result = await repo.acceptOffer(bookingId, partner._id, userId, now);
    if (result === 'NOT_FOUND') {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, 'Job not found');
    }
    if (result === 'EXPIRED_OR_UNAVAILABLE') {
      throw httpError(409, ERROR_CODES.CONFLICT, 'This job offer has expired or has already been accepted by another partner');
    }
    return { success: true, message: 'Job accepted successfully' };
  },

  /** POST /partner/jobs/:id/reject */
  async rejectOffer(userId: string, bookingId: string) {
    const partner = await getPartnerProfile(userId);
    if (!partner) {
      throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'No partner profile found for this account');
    }
    const result = await repo.rejectOffer(bookingId, partner._id);
    if (result === 'NOT_FOUND') {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, 'Job not found');
    }
    return { success: true, message: 'Job rejected' };
  },

  /** PATCH /bookings/:id/status for partners. Goes through the booking state machine. */
  async updateStatus(
    userId: string,
    bookingId: string,
    target: string,
    reason?: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);

    if (target === "in_progress") {
      throw invalid(
        "A job can only be started after the customer OTP is verified",
      );
    }
    if (!isPartnerTarget(target)) {
      throw invalid(
        `A partner cannot set a job to "${target}" from this screen`,
      );
    }

    // Validate with the shared state machine on a throw-away copy; 409 from the machine becomes 422 here.
    const probe = {
      status: booking.status,
      statusHistory: [] as JobBookingDoc["statusHistory"],
    };
    let entry;
    try {
      entry = applyTransition(
        probe,
        target,
        { role: "partner", id: userId },
        reason,
        now,
      );
    } catch (err) {
      if (
        err instanceof HttpError &&
        err.code === ERROR_CODES.INVALID_STATE_TRANSITION
      ) {
        throw invalid(err.message);
      }
      throw err;
    }

    const applied = await repo.transitionStatus(
      bookingId,
      partner._id,
      booking.status,
      target,
      entry,
    );
    if (!applied)
      throw invalid(
        "This job was already updated. Refresh to see its latest status",
      );

    const fresh = await repo.findBooking(bookingId);
    if (!fresh)
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    return buildDetail(fresh);
  },
};
