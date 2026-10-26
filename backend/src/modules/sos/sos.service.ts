import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import { auditService } from "../audit/audit.service";
import { getIOIfReady, rooms } from "../../sockets";
import { sosRepository, type SosRepository, type SosRowRaw } from "./sos.repository";
import type { SosAlertDto, TriggerSosResultDto } from "./sos.types";
import type { TriggerSosBody } from "./sos.validation";

/** A second press inside this window returns the first alert instead of paging the admins again. */
export const SOS_DEDUPE_WINDOW_MS = 60_000;

export const SOS_EVENT = "partner:sos";

const toDto = (r: SosRowRaw): SosAlertDto => ({
  id: r.id,
  partnerId: r.partnerId,
  bookingId: r.bookingId,
  location: r.location,
  status: r.status,
  triggeredAt: r.triggeredAt.toISOString(),
});

export interface SosDeps {
  repo: SosRepository;
  /** Sends the alert to the admin room. Must never throw into the request. */
  notifyAdmins: (alert: SosAlertDto) => void;
  audit: (input: { actor: string; entityId: string; ip: string; after: unknown }) => Promise<unknown>;
  now: () => Date;
}

const defaultDeps: SosDeps = {
  repo: sosRepository,
  notifyAdmins: (alert) => {
    const io = getIOIfReady();
    if (io) io.to(rooms.role("admin")).emit(SOS_EVENT, alert);
  },
  audit: (i) =>
    auditService.recordAudit({
      actor: i.actor,
      action: "partner.sos.triggered",
      entity: "SosAlert",
      entityId: i.entityId,
      before: null,
      after: i.after,
      ip: i.ip,
      result: "Success",
    }),
  now: () => new Date(),
};

export const sosService = {
  /**
   * POST /partner/safety/sos
   * @param userId from the verified JWT, never from the request
   */
  async trigger(
    userId: string,
    body: TriggerSosBody,
    ip: string,
    deps: SosDeps = defaultDeps,
  ): Promise<TriggerSosResultDto> {
    const { repo } = deps;
    const partnerId = await repo.findPartnerIdByUserId(userId);
    if (!partnerId) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, "No partner profile found for this account");

    // A booking id is optional, but if given it must be assigned to this partner.
    let bookingId: string | null = null;
    if (body.bookingId) {
      const owns = await repo.bookingBelongsToPartner(body.bookingId, partnerId);
      if (!owns) throw Errors.notFound(ERROR_CODES.BOOKING_NOT_FOUND, "Booking not found");
      bookingId = body.bookingId;
    }

    // Repeated presses within the window return the first alert instead of paging admins again.
    const now = deps.now();
    const since = new Date(now.getTime() - SOS_DEDUPE_WINDOW_MS);
    const existing = await repo.findRecentActive(partnerId, since);
    if (existing) return { alert: toDto(existing), duplicate: true };

    const row = await repo.create({
      partnerId,
      bookingId,
      location: body.location ?? null,
      note: body.note,
      triggeredAt: now,
    });
    const alert = toDto(row);

    // The alert is saved. A socket or audit failure must never make the SOS request fail.
    try {
      deps.notifyAdmins(alert);
    } catch (err) {
      console.error("[sos] notifyAdmins failed", err);
    }
    try {
      await deps.audit({ actor: userId, entityId: alert.id, ip, after: alert });
    } catch (err) {
      console.error("[sos] audit failed", err);
    }

    return { alert, duplicate: false };
  },
};