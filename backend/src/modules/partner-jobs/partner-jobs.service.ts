import { Types } from "mongoose";
import { ERROR_CODES } from "../../constants/errorCodes";
import { HttpError } from "../auth/auth.types";
import { Errors, httpError } from "../../utils/errors";
import type { BookingStatus } from "../bookings/bookings.constants";
import { applyTransition } from "../bookings/bookings.stateMachine";
import { trackingService } from "../../services/TrackingService";
import { emitJobCompleted } from "../events/eventBus";
import { getIOIfReady, rooms } from "../../sockets";
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
import { alertSos } from "../notifications/admin-alerts";
import { environmentConfig } from "../../config/environment";

const money = (n: number): number => Math.round(n * 100) / 100;

/** What the customer owes on site: the service price plus any extra charges they approved. */
const amountDueOf = (booking: JobBookingDoc): number =>
  money(
    Number(booking.priceBreakdown?.total ?? 0) +
      (booking.extraCharges ?? [])
        .filter((charge) => charge.status === "approved")
        .reduce((sum, charge) => sum + Number(charge.amount) * Number(charge.quantity || 1), 0),
  );

/** upi://pay deep link that every UPI app turns into a pay screen when the QR is scanned. */
const buildUpiUri = (booking: JobBookingDoc, amount: number): string | null => {
  const payee = environmentConfig.upiPayeeId;
  if (!payee || amount <= 0) return null;

  const params = new URLSearchParams({
    pa: payee,
    pn: environmentConfig.upiPayeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `Booking ${booking._id.toString().slice(-6).toUpperCase()}`,
  });

  return `upi://pay?${params.toString()}`;
};

/** "Rahul Kumar" -> "Rahul K." */
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

/** Buttons the partner may press right now. */
export const actionsFor = (status: BookingStatus): JobActionDto[] => {
  if (status === "assigned") {
    return [{ status: "en_route", label: "On the way" }];
  }

  if (status === "en_route") {
    return [{ status: "arrived", label: "Arrived" }];
  }

  return [];
};

const toChecklist = (
  booking: JobBookingDoc,
  inclusions: string[],
): JobChecklistItemDto[] => {
  if (booking.checklist && booking.checklist.length > 0) {
    return booking.checklist.map((item) => ({
      id: item.id,
      label: item.label,
      done: item.done,
    }));
  }

  return inclusions.map((label, index) => ({
    id: `inc-${index + 1}`,
    label,
    done: false,
  }));
};

const toAddOns = (
  booking: JobBookingDoc,
  catalog: Array<{
    _id: Types.ObjectId;
    name: string;
    price: number;
  }>,
): JobAddOnDto[] => {
  const fromSnapshot = (booking.priceSnapshot?.lines ?? []).filter(
    (line) => line.kind === "ADDON",
  );

  if (fromSnapshot.length > 0) {
    return fromSnapshot.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      amount: money(line.amount),
    }));
  }

  return booking.addOns.flatMap((addOn) => {
    const found = catalog.find(
      (item) => item._id.toString() === addOn.addOnId.toString(),
    );

    return found
      ? [
          {
            name: found.name,
            quantity: addOn.quantity,
            amount: money(found.price * addOn.quantity),
          },
        ]
      : [];
  });
};

async function getPartnerProfile(userId: string) {
  let partner = await repo.findPartnerByUserId(userId);

  if (!partner) {
    try {
      await ensurePartnerProfile(userId);
      partner = await repo.findPartnerByUserId(userId);
    } catch {
      // Profile provisioning may not be available for every account.
    }
  }

  if (!partner) {
    throw Errors.notFound(
      ERROR_CODES.PARTNER_NOT_FOUND,
      "No partner profile found for this account",
    );
  }

  return partner;
}

/** Loads a booking and verifies ownership by the signed-in partner. */
const START_OTP_MAX_ATTEMPTS = 5;

async function loadOwnedBooking(userId: string, bookingId: string) {
  const partner = await getPartnerProfile(userId);
  const booking = await repo.findBooking(bookingId);

  if (!booking) {
    throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
  }

  if (
    !booking.partnerId ||
    booking.partnerId.toString() !== partner._id.toString()
  ) {
    throw Errors.notOwner();
  }

  return { partner, booking };
}

async function buildDetail(booking: JobBookingDoc): Promise<JobDetailDto> {
  const [customer, service] = await Promise.all([
    repo.findCustomer(booking.customerId),
    booking.serviceId
      ? repo.findService(booking.serviceId)
      : Promise.resolve(null),
  ]);

  const coordinates = booking.address.location?.coordinates;

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
        coordinates && coordinates.length === 2
          ? {
              lat: coordinates[1],
              lng: coordinates[0],
            }
          : null,
    },
    schedule: {
      scheduledAt: booking.scheduledAt.toISOString(),
      date: booking.date ?? null,
      slot: booking.slot ?? null,
      startedAt: booking.startedAt
        ? booking.startedAt.toISOString()
        : null,
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
      method: booking.paymentDetails?.method ?? null,
      amountDue: amountDueOf(booking),
      upiUri:
        booking.paymentStatus === "PAID"
          ? null
          : buildUpiUri(booking, amountDueOf(booking)),
    },
    customerRating:
      typeof booking.customerRating?.rating === "number"
        ? {
            rating: booking.customerRating.rating,
            comment: booking.customerRating.comment ?? null,
          }
        : null,
    actions: actionsFor(booking.status),
    otpRequired: booking.status === "arrived",
    statusHistory: booking.statusHistory.map((history) => ({
      from: history.from,
      to: history.to,
      at: history.at.toISOString(),
      actorRole: history.actorRole,
      actorId: history.actorId ?? null,
      reason: history.reason ?? null,
    })),
  };
}

const invalid = (message: string): HttpError =>
  httpError(422, ERROR_CODES.INVALID_STATE_TRANSITION, message);

/** Statuses where navigation, chat, and masked calling are relevant. */
const LIVE_STATUSES: BookingStatus[] = [
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
];

export const partnerJobsService = {
  /** GET /partner/jobs */
  async listLiveJobs(
    userId: string,
    scope: "live" | "completed" | "cancelled" = "live",
  ): Promise<JobListItemDto[]> {
    const partner = await getPartnerProfile(userId);
    const statuses: BookingStatus[] =
      scope === "completed"
        ? ["completed", "rated"]
        : scope === "cancelled"
          ? ["cancelled_by_customer", "cancelled_by_admin"]
          : LIVE_STATUSES;
    const rows = await repo.listLiveForPartner(partner._id, statuses);

    // One query for all service photos (skip very large inline data: images).
    const serviceIds = [
      ...new Set(
        rows.flatMap((b) => (b.serviceId ? [b.serviceId.toString()] : [])),
      ),
    ].map((id) => new Types.ObjectId(id));
    const services = serviceIds.length
      ? await repo.findServiceMedia(serviceIds)
      : [];
    const imageByService = new Map<string, string>();
    for (const svc of services) {
      const url = svc.media?.[0]?.url;
      if (url && !(url.startsWith("data:") && url.length > 100_000)) {
        imageByService.set(svc._id.toString(), url);
      }
    }

    return rows.map((booking) => ({
      id: booking._id.toString(),
      status: booking.status,
      service: { name: booking.serviceName },
      customerName: maskName(booking.customerName),
      address: [
        booking.address.line1,
        booking.address.area,
        booking.address.city,
      ]
        .filter(Boolean)
        .join(", "),
      scheduledAt: booking.scheduledAt.toISOString(),
      slot: booking.slot ?? null,
      // partnerEarning is 0 until payout is calculated, so fall back to the
      // booking total (same rule as the job-request cards).
      partnerEarning: money(
        booking.partnerEarning || booking.priceBreakdown?.total || 0,
      ),
      imageUrl: booking.serviceId
        ? (imageByService.get(booking.serviceId.toString()) ?? null)
        : null,
    }));
  },

  /** GET /partner/jobs/:id */
  async getJob(
    userId: string,
    bookingId: string,
  ): Promise<JobDetailDto> {
    const { booking } = await loadOwnedBooking(userId, bookingId);
    return buildDetail(booking);
  },

  /** GET /partner/job-requests */
  async listRequests(
    userId: string,
    now: Date = new Date(),
  ): Promise<JobRequestDto[]> {
    const partner = await getPartnerProfile(userId);
    const bookings = await repo.findJobRequests(partner._id, now);

    return bookings.flatMap((booking): JobRequestDto[] => {
      const offer = booking.offers?.find(
        (item) =>
          item.partnerId.toString() === partner._id.toString() &&
          item.response === "pending",
      );

      if (!offer?.expiresAt) return [];

      return [
        {
          id: booking._id.toString(),
          service: booking.serviceName,
          area: booking.address.area || booking.address.city,
          price: money(
            booking.partnerEarning ||
              booking.priceBreakdown?.total ||
              0,
          ),
          scheduledAt: booking.scheduledAt.toISOString(),
          expiresAt: offer.expiresAt.toISOString(),
        },
      ];
    });
  },

  /** POST /partner/jobs/:id/accept */
  async acceptOffer(
    userId: string,
    bookingId: string,
    now: Date = new Date(),
  ) {
    const partner = await getPartnerProfile(userId);
    const result = await repo.acceptOffer(
      bookingId,
      partner._id,
      userId,
      now,
    );

    if (result === "NOT_FOUND") {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    if (result === "EXPIRED_OR_UNAVAILABLE") {
      throw httpError(
        409,
        ERROR_CODES.CONFLICT,
        "This job offer has expired or has already been accepted by another partner",
      );
    }

    return {
      success: true,
      message: "Job accepted successfully",
    };
  },

  /** POST /partner/jobs/:id/reject */
  async rejectOffer(userId: string, bookingId: string, reason?: string) {
    const partner = await getPartnerProfile(userId);
    const result = await repo.rejectOffer(bookingId, partner._id, reason);

    if (result === "NOT_FOUND") {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    return {
      success: true,
      message: "Job rejected",
    };
  },

  /** POST /partner/jobs/:id/collect-payment: the partner took cash or a UPI payment on site. */
  async collectPayment(
    userId: string,
    bookingId: string,
    method: "cash" | "upi",
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);

    if (booking.status !== "completed" && booking.status !== "rated") {
      throw invalid("Payment can be collected only after the service is completed");
    }

    if (booking.paymentStatus !== "PAID") {
      const applied = await repo.markPaid(bookingId, partner._id, method, now);

      if (!applied) {
        throw invalid("This job was already updated. Refresh to see its latest status");
      }
    }

    const fresh = await repo.findBooking(bookingId);

    if (!fresh) {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/rate-customer: only after payment, and only once. */
  async rateCustomer(
    userId: string,
    bookingId: string,
    rating: number,
    comment?: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);

    if (booking.status !== "completed" && booking.status !== "rated") {
      throw invalid("You can rate the customer only after the service is completed");
    }

    if (booking.paymentStatus !== "PAID") {
      throw invalid("Collect the payment before rating the customer");
    }

    if (typeof booking.customerRating?.rating !== "number") {
      const applied = await repo.saveCustomerRating(
        bookingId,
        partner._id,
        rating,
        comment,
        now,
      );

      if (!applied) {
        throw invalid("This job was already updated. Refresh to see its latest status");
      }
    }

    const fresh = await repo.findBooking(bookingId);

    if (!fresh) {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/sos */
  async raiseSos(
    userId: string,
    bookingId: string,
    coordinates?: { lat: number; lng: number } | null,
  ): Promise<{ sent: true }> {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

    if (!LIVE_STATUSES.includes(booking.status)) {
      throw invalid("SOS is only available while a job is active");
    }

    alertSos({
      bookingId: booking._id.toString(),
      partnerId: partner._id.toString(),
      coordinates: coordinates ?? null,
    });

    return { sent: true };
  },

  /** PATCH /bookings/:id/status */
  async updateStatus(
    userId: string,
    bookingId: string,
    target: string,
    reason?: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

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
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.code === ERROR_CODES.INVALID_STATE_TRANSITION
      ) {
        throw invalid(error.message);
      }

      throw error;
    }

    const applied = await repo.transitionStatus(
      bookingId,
      partner._id,
      booking.status,
      target,
      entry,
    );

    if (!applied) {
      throw invalid(
        "This job was already updated. Refresh to see its latest status",
      );
    }

    trackingService.emitStatus(bookingId, target, entry.at);

    const fresh = await repo.findBooking(bookingId);

    if (!fresh) {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/verify-start */
  async verifyStart(
    userId: string,
    bookingId: string,
    otp: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

    if (booking.status === "in_progress") {
      return buildDetail(booking);
    }

    if (booking.status !== "arrived") {
      throw invalid("You can only start a job after you have arrived");
    }

    const used = booking.startOtpAttempts ?? 0;

    if (used >= START_OTP_MAX_ATTEMPTS) {
      throw httpError(
        423,
        ERROR_CODES.OTP_LOCKED,
        "Too many incorrect codes. This job is locked, please contact support",
      );
    }

    // otpCodes.start is `select: false`, so the plain booking load never has it.
    const expectedOtp = await repo.getStartOtp(bookingId);

    if (!expectedOtp) {
      throw invalid(
        "The customer's start code is not ready yet. Ask the customer to open the booking and try again",
      );
    }

    if (otp !== expectedOtp) {
      const total = await repo.recordFailedStartAttempt(bookingId);
      const remaining = Math.max(0, START_OTP_MAX_ATTEMPTS - total);

      if (remaining === 0) {
        throw httpError(
          423,
          ERROR_CODES.OTP_LOCKED,
          "Too many incorrect codes. This job is locked, please contact support",
        );
      }

      throw httpError(
        422,
        ERROR_CODES.INVALID_OTP,
        `Incorrect code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} left`,
        [{ field: "attemptsRemaining", message: String(remaining) }],
      );
    }

    const probe = {
      status: booking.status,
      statusHistory: [] as JobBookingDoc["statusHistory"],
    };

    const entry = applyTransition(
      probe,
      "in_progress",
      { role: "partner", id: userId },
      "Start verification code verified",
      now,
    );

    const applied = await repo.verifyStartJob(
      bookingId,
      partner._id,
      entry,
      now,
    );

    if (!applied) {
      throw invalid(
        "This job was already updated. Refresh to see its latest status",
      );
    }

    trackingService.emitStatus(bookingId, "in_progress", entry.at);

    const fresh = await repo.findBooking(bookingId);

    if (!fresh) {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/complete */
  async completeJob(
    userId: string,
    bookingId: string,
    notes?: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

    if (booking.status === "completed") {
      return buildDetail(booking);
    }

    if (booking.status !== "in_progress") {
      throw invalid(
        "You can only complete a job that is currently in progress",
      );
    }

    const pendingCharges = (booking.extraCharges ?? []).filter(
      (charge) => charge.status === "pending",
    );

    if (pendingCharges.length > 0) {
      throw httpError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot complete job while extra charges are still pending customer approval",
      );
    }

    const probe = {
      status: booking.status,
      statusHistory: [] as JobBookingDoc["statusHistory"],
    };

    const entry = applyTransition(
      probe,
      "completed",
      { role: "partner", id: userId },
      notes || "Job completed by partner",
      now,
    );

    const applied = await repo.completePartnerJob(
      bookingId,
      partner._id,
      entry,
      now,
    );

    if (!applied) {
      throw invalid(
        "This job was already updated. Refresh to see its latest status",
      );
    }

    trackingService.emitStatus(bookingId, "completed", entry.at);

    const fresh = await repo.findBooking(bookingId);

    if (!fresh) {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }

    const gross = Number(fresh.priceBreakdown?.total ?? 0);

    if (Number.isFinite(gross) && gross > 0) {
      emitJobCompleted({
        bookingId,
        partnerId: String(partner._id),
        gross,
        completedAt: now,
      });
    }

    return buildDetail(fresh);
  },

  /** GET /partner/jobs/:id/extra-charges */
  async listExtraCharges(userId: string, bookingId: string) {
    const { booking } = await loadOwnedBooking(userId, bookingId);

    return (booking.extraCharges ?? []).map((charge) => ({
      id: charge._id.toString(),
      title: charge.title,
      description: charge.title,
      quantity: charge.quantity || 1,
      amount: money(charge.amount),
      reason: charge.reason,
      status: charge.status,
      requestedAt: charge.requestedAt
        ? charge.requestedAt.toISOString()
        : undefined,
      decidedAt: charge.decidedAt
        ? charge.decidedAt.toISOString()
        : undefined,
    }));
  },

  /** POST /partner/jobs/:id/extra-charges */
  async createExtraCharge(
    userId: string,
    bookingId: string,
    data: {
      description: string;
      quantity: number;
      amount: number;
      reason?: string;
    },
    now: Date = new Date(),
  ) {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

    if (booking.status !== "in_progress") {
      throw invalid("Extra charges can only be added while a job is in progress");
    }

    const chargeId = new Types.ObjectId();

    const newCharge = {
      _id: chargeId,
      title: data.description,
      reason: data.reason,
      amount: money(data.amount),
      quantity: data.quantity || 1,
      status: "pending" as const,
      requestedAt: now,
    };

    const added = await repo.addExtraCharge(
      booking._id.toString(),
      partner._id,
      newCharge,
    );

    if (!added) {
      throw invalid(
        "The job could not be updated. Refresh and try again",
      );
    }

    try {
      const io = getIOIfReady();

      if (io) {
        const canonicalBookingId = booking._id.toString();

        const payload = {
          bookingId: canonicalBookingId,
          charge: {
            id: chargeId.toString(),
            _id: chargeId.toString(),
            title: newCharge.title,
            amount: newCharge.amount,
            quantity: newCharge.quantity,
            reason: newCharge.reason,
            status: "pending",
            requestedAt: now.toISOString(),
          },
        };

        io.to(rooms.booking(canonicalBookingId)).emit(
          "booking:extra_charge",
          payload,
        );
        io.to(rooms.booking(canonicalBookingId)).emit(
          "booking:updated",
          { bookingId: canonicalBookingId },
        );

        if (booking.customerId) {
          io.to(rooms.user(booking.customerId.toString())).emit(
            "booking:updated",
            { bookingId: canonicalBookingId },
          );
        }
      }
    } catch {
      // Socket notifications are best-effort.
    }

    return {
      id: chargeId.toString(),
      title: newCharge.title,
      description: newCharge.title,
      quantity: newCharge.quantity,
      amount: newCharge.amount,
      reason: newCharge.reason,
      status: "pending",
      requestedAt: now.toISOString(),
    };
  },

  /** PATCH /partner/jobs/:id/checklist/:itemId */
  async updateChecklistItem(
    userId: string,
    bookingId: string,
    itemId: string,
    done: boolean,
  ) {
    const { partner, booking } = await loadOwnedBooking(
      userId,
      bookingId,
    );

    let checklist =
      booking.checklist && booking.checklist.length > 0
        ? [...booking.checklist]
        : [];

    if (checklist.length === 0 && booking.serviceId) {
      const service = await repo.findService(booking.serviceId);
      checklist = toChecklist(booking, service?.inclusions ?? []);
    }

    const index = checklist.findIndex((item) => item.id === itemId);

    if (index >= 0) {
      checklist[index] = {
        ...checklist[index],
        done,
      };
    } else {
      checklist.push({
        id: itemId,
        label: itemId,
        done,
      });
    }

    const updated = await repo.updateChecklist(
      bookingId,
      partner._id,
      checklist,
    );

    if (!updated) {
      throw invalid(
        "The checklist could not be updated. Refresh and try again",
      );
    }

    return { checklist };
  },
};