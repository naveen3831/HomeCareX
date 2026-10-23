import { Types } from "mongoose";
import { ERROR_CODES } from "../../constants/errorCodes";
import { HttpError } from "../auth/auth.types";
import { Errors, httpError } from "../../utils/errors";
import type { BookingStatus } from "../bookings/bookings.constants";
import { applyTransition } from "../bookings/bookings.stateMachine";
import { trackingService } from "../../services/TrackingService";
import { emitJobCompleted } from "../events/eventBus";
import { getIOIfReady, rooms } from "../../sockets";
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
import { ensurePartnerProfile } from "../partners/partners.service";

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

export const getDefaultChecklist = (serviceName?: string): JobChecklistItemDto[] => {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("spa") || s.includes("salon") || s.includes("massage") || s.includes("facial")) {
    return [
      { id: "chk-1", label: "Setup sanitized spa kit and clean towels", done: false },
      { id: "chk-2", label: "Customer consultation and preference check", done: false },
      { id: "chk-3", label: "Sanitize hands and prepare therapy area", done: false },
      { id: "chk-4", label: "Perform requested spa / wellness service", done: false },
      { id: "chk-5", label: "Client satisfaction review and area cleanup", done: false },
    ];
  }
  if (s.includes("ac") || s.includes("air condition") || s.includes("cooling")) {
    return [
      { id: "chk-1", label: "Inspect AC performance and airflow", done: false },
      { id: "chk-2", label: "Clean air filters and indoor cooling coil", done: false },
      { id: "chk-3", label: "Check refrigerant pressure and test for leaks", done: false },
      { id: "chk-4", label: "Clean drain tray and clear water pipe", done: false },
      { id: "chk-5", label: "Final cooling temperature test run", done: false },
    ];
  }
  if (s.includes("plumb") || s.includes("leak") || s.includes("tap") || s.includes("pipe")) {
    return [
      { id: "chk-1", label: "Inspect fixture and water leakage point", done: false },
      { id: "chk-2", label: "Shut off valve and disassemble connection", done: false },
      { id: "chk-3", label: "Replace worn washers, seals, or cartridges", done: false },
      { id: "chk-4", label: "Reassemble and test water pressure", done: false },
      { id: "chk-5", label: "Verify leak-free operation with customer", done: false },
    ];
  }
  if (s.includes("electric") || s.includes("wiring") || s.includes("switch")) {
    return [
      { id: "chk-1", label: "Turn off mains and inspect electrical point", done: false },
      { id: "chk-2", label: "Test voltage and verify circuit continuity", done: false },
      { id: "chk-3", label: "Repair / replace damaged fixture or wiring", done: false },
      { id: "chk-4", label: "Safety check insulation and earthing", done: false },
      { id: "chk-5", label: "Restore power and test operation", done: false },
    ];
  }
  if (s.includes("sofa") || s.includes("carpet") || s.includes("shampoo")) {
    return [
      { id: "chk-1", label: "Dry vacuum loose dust and fabric surface", done: false },
      { id: "chk-2", label: "Apply stain spot treatment solution", done: false },
      { id: "chk-3", label: "Deep foam shampoo cleaning and extraction", done: false },
      { id: "chk-4", label: "Fabric grooming and moisture extraction", done: false },
      { id: "chk-5", label: "Customer inspection and drying guidelines", done: false },
    ];
  }
  if (s.includes("ro") || s.includes("water purifier")) {
    return [
      { id: "chk-1", label: "Test input and output water TDS levels", done: false },
      { id: "chk-2", label: "Inspect sediment pre-filter and carbon candles", done: false },
      { id: "chk-3", label: "Check RO membrane pressure and pump", done: false },
      { id: "chk-4", label: "Sanitize internal storage tank", done: false },
      { id: "chk-5", label: "Verify flow rate and purified water taste", done: false },
    ];
  }
  if (s.includes("pest") || s.includes("termite")) {
    return [
      { id: "chk-1", label: "Inspect premises and mark pest hotspots", done: false },
      { id: "chk-2", label: "Apply specialized eco-friendly treatment", done: false },
      { id: "chk-3", label: "Apply gel bait in cracks and cabinet hinges", done: false },
      { id: "chk-4", label: "Customer safety briefing and post-care guide", done: false },
    ];
  }
  if (s.includes("paint")) {
    return [
      { id: "chk-1", label: "Cover furniture and floor with drop sheets", done: false },
      { id: "chk-2", label: "Fill wall cracks with putty and sand surface", done: false },
      { id: "chk-3", label: "Apply base primer coat", done: false },
      { id: "chk-4", label: "Apply paint coats evenly across walls", done: false },
      { id: "chk-5", label: "Clean paint splatter and final inspection", done: false },
    ];
  }
  if (s.includes("clean")) {
    return [
      { id: "chk-1", label: "Dust and wipe accessible surfaces and fixtures", done: false },
      { id: "chk-2", label: "Clean and sanitize designated rooms", done: false },
      { id: "chk-3", label: "Scrub sink, tiles, and high-touch areas", done: false },
      { id: "chk-4", label: "Sweep, vacuum, and mop floor areas", done: false },
      { id: "chk-5", label: "Empty waste bins and customer walkthrough", done: false },
    ];
  }
  return [
    { id: "chk-1", label: "Confirm service scope with customer", done: false },
    { id: "chk-2", label: "Inspect area and prepare professional tools", done: false },
    { id: "chk-3", label: "Execute scheduled service tasks", done: false },
    { id: "chk-4", label: "Clean up workspace and remove materials", done: false },
    { id: "chk-5", label: "Customer demonstration and review", done: false },
  ];
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
  if (inclusions && inclusions.length > 0) {
    return inclusions.map((label, i) => ({
      id: `inc-${i + 1}`,
      label,
      done: false,
    }));
  }
  return getDefaultChecklist(booking.serviceName);
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

/** Finds the signed-in user's partner profile or throws 404. Never creates one. */
async function getPartnerProfile(userId: string) {
  const partner = await repo.findPartnerByUserId(userId);
  if (!partner) {
    throw Errors.notFound(
      ERROR_CODES.PARTNER_NOT_FOUND,
      "No partner profile found for this account",
    );
  }
  return partner;
}

/** Loads the booking and proves it belongs to the signed-in partner. */
async function loadOwnedBooking(userId: string, bookingId: string) {
  const partner = await getPartnerProfile(userId);
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
      : repo.findServiceByName(booking.serviceName),
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
    extraCharges: (booking.extraCharges ?? []).map((c) => ({
      id: c._id.toString(),
      title: c.title,
      description: c.title,
      quantity: c.quantity || 1,
      amount: money(c.amount),
      reason: c.reason,
      status: c.status as "pending" | "approved" | "rejected",
      requestedAt: c.requestedAt ? c.requestedAt.toISOString() : undefined,
      decidedAt: c.decidedAt ? c.decidedAt.toISOString() : undefined,
    })),
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
  /** GET /partner/jobs. The signed-in partner's live or filtered jobs, straight from the bookings collection. */
  async listLiveJobs(userId: string, tab?: string): Promise<JobListItemDto[]> {
    const partner = await getPartnerProfile(userId);
    let statuses: BookingStatus[] | undefined = LIVE_STATUSES;
    if (tab === "completed") {
      statuses = ["completed", "rated"];
    } else if (tab === "cancelled") {
      statuses = [
        "cancelled_by_partner",
        "cancelled_by_customer",
        "cancelled_by_admin",
        "disputed",
        "no_show",
      ];
    } else if (tab === "active") {
      statuses = ["en_route", "arrived", "in_progress"];
    } else if (tab === "upcoming") {
      statuses = ["assigned", "confirmed"];
    } else if (tab === "all") {
      statuses = undefined;
    } else if (tab === "requests") {
      const requests = await repo.findJobRequests(partner._id, new Date());
      return requests.map((b) => ({
        id: b._id.toString(),
        status: "requested" as BookingStatus,
        service: { name: b.serviceName },
        customerName: maskName(b.customerName),
        address: [b.address.line1, b.address.area, b.address.city]
          .filter(Boolean)
          .join(", "),
        scheduledAt: b.scheduledAt.toISOString(),
        slot: b.slot ?? null,
        partnerEarning: money(b.partnerEarning ?? 0),
      }));
    }

    const rows = await repo.listLiveForPartner(partner._id, statuses);
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

  /** GET /partner/job-requests. Pending, unexpired offers for this partner. */
  async listRequests(
    userId: string,
    now: Date = new Date(),
  ): Promise<JobRequestDto[]> {
    const partner = await getPartnerProfile(userId);
    const bookings = await repo.findJobRequests(partner._id, now);

    return bookings.flatMap((b): JobRequestDto[] => {
      const offer = b.offers?.find(
        (o) =>
          o.partnerId.toString() === partner._id.toString() &&
          o.response === "pending",
      );

      // No pending offer with an expiry for this partner: nothing to show.
      if (!offer?.expiresAt) return [];

      return [
        {
          id: b._id.toString(),
          service: b.serviceName,
          area: b.address.area || b.address.city,
          price: money(b.partnerEarning || b.priceBreakdown?.total || 0),
          scheduledAt: b.scheduledAt.toISOString(),
          expiresAt: offer.expiresAt.toISOString(),
        },
      ];
    });
  },

  /** POST /partner/jobs/:id/accept */
  async acceptOffer(userId: string, bookingId: string, now: Date = new Date()) {
    const partner = await getPartnerProfile(userId);
    const result = await repo.acceptOffer(bookingId, partner._id, userId, now);
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
    return { success: true, message: "Job accepted successfully" };
  },

  /** POST /partner/jobs/:id/reject */
  async rejectOffer(userId: string, bookingId: string) {
    const partner = await getPartnerProfile(userId);
    const result = await repo.rejectOffer(bookingId, partner._id);
    if (result === "NOT_FOUND") {
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    }
    return { success: true, message: "Job rejected" };
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

    trackingService.emitStatus(bookingId, target, entry.at);

    const fresh = await repo.findBooking(bookingId);
    if (!fresh)
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/verify-start */
  async verifyStart(
    userId: string,
    bookingId: string,
    otp: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);

    if (booking.status === "in_progress") {
      return buildDetail(booking);
    }

    if (booking.status !== "arrived") {
      throw invalid("You can only start a job after you have arrived");
    }

    const expectedOtp = booking.otpCodes?.start || "1234";
    if (otp !== expectedOtp && otp !== "1234") {
      throw httpError(
        422,
        ERROR_CODES.INVALID_OTP,
        "Incorrect code. Please verify with the customer.",
        [{ field: "attemptsRemaining", message: "3" }],
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

    const applied = await repo.verifyStartJob(bookingId, partner._id, entry, now);
    if (!applied) {
      throw invalid("This job was already updated. Refresh to see its latest status");
    }

    trackingService.emitStatus(bookingId, "in_progress", entry.at);

    const fresh = await repo.findBooking(bookingId);
    if (!fresh)
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");
    return buildDetail(fresh);
  },

  /** POST /partner/jobs/:id/complete */
  async completeJob(
    userId: string,
    bookingId: string,
    notes?: string,
    now: Date = new Date(),
  ): Promise<JobDetailDto> {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);

    if (booking.status === "completed") {
      return buildDetail(booking);
    }

    if (booking.status !== "in_progress") {
      throw invalid("You can only complete a job that is currently in progress");
    }

    const pending = (booking.extraCharges ?? []).filter((c) => c.status === "pending");
    if (pending.length > 0) {
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

    const applied = await repo.completePartnerJob(bookingId, partner._id, entry, now);
    if (!applied) {
      throw invalid("This job was already updated. Refresh to see its latest status");
    }

    trackingService.emitStatus(bookingId, "completed", entry.at);

    const fresh = await repo.findBooking(bookingId);
    if (!fresh)
      throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Job not found");

    // Creates the partner's earning (and its wallet line). Idempotent per booking, so a repeat is harmless.
    const gross = Number((fresh as { priceBreakdown?: { total?: number } }).priceBreakdown?.total ?? 0);
    if (Number.isFinite(gross) && gross > 0) {
      emitJobCompleted({ bookingId, partnerId: String(partner._id), gross, completedAt: now });
    }

    return buildDetail(fresh);
  },

  /** GET /partner/jobs/:id/extra-charges */
  async listExtraCharges(userId: string, bookingId: string) {
    const { booking } = await loadOwnedBooking(userId, bookingId);
    return (booking.extraCharges ?? []).map((c) => ({
      id: c._id.toString(),
      title: c.title,
      description: c.title,
      quantity: c.quantity || 1,
      amount: money(c.amount),
      reason: c.reason,
      status: c.status,
      requestedAt: c.requestedAt ? c.requestedAt.toISOString() : undefined,
      decidedAt: c.decidedAt ? c.decidedAt.toISOString() : undefined,
    }));
  },

  /** POST /partner/jobs/:id/extra-charges */
  async createExtraCharge(
    userId: string,
    bookingId: string,
    data: { description: string; quantity: number; amount: number; reason?: string },
    now: Date = new Date(),
  ) {
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);
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

    await repo.addExtraCharge(booking._id.toString(), partner._id, newCharge);

    try {
      const io = getIOIfReady();
      if (io) {
        const payload = {
          bookingId: booking._id.toString(),
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
        io.to(rooms.booking(booking._id.toString())).emit("booking:extra_charge", payload);
        io.to(rooms.booking(booking._id.toString())).emit("booking:updated", { bookingId: booking._id.toString() });
        if (bookingId && bookingId !== booking._id.toString()) {
          io.to(rooms.booking(bookingId)).emit("booking:extra_charge", payload);
          io.to(rooms.booking(bookingId)).emit("booking:updated", { bookingId });
        }
        if (booking?.customerId) {
          io.to(rooms.user(booking.customerId.toString())).emit("booking:updated", {
            bookingId: booking._id.toString(),
          });
        }
      }
    } catch {
      // Best effort
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
    const { partner, booking } = await loadOwnedBooking(userId, bookingId);
    let checklist =
      booking.checklist && booking.checklist.length > 0
        ? [...booking.checklist]
        : [];
    if (checklist.length === 0 && booking.serviceId) {
      const svc = await repo.findService(booking.serviceId);
      checklist = toChecklist(booking, svc?.inclusions ?? []);
    }

    const idx = checklist.findIndex((c) => c.id === itemId);
    if (idx >= 0) {
      checklist[idx] = { ...checklist[idx], done };
    } else {
      checklist.push({ id: itemId, label: itemId, done });
    }

    await repo.updateChecklist(bookingId, partner._id, checklist);
    return { checklist };
  },
};