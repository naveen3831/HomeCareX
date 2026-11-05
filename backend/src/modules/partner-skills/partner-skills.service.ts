import { Types } from "mongoose";
import { ERROR_CODES } from "../../constants/errorCodes";
import { Errors } from "../../utils/errors";
import PartnerModel from "../../models/Partner";
import UserModel from "../../models/User";
import { auditService } from "../audit/audit.service";
import { notify, notifyAdmins } from "../notifications";
import SkillRequestModel, { type SkillRequestStatus } from "./SkillRequest";

const MAX_PENDING = 5;

export interface SkillRequestDto {
  id: string;
  name: string;
  status: SkillRequestStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PartnerSkillsDto {
  /** Skills on the profile: the ones chosen when joining plus any approved later. */
  skills: string[];
  /** Requests still waiting for an admin, and rejected ones (approved requests are already in `skills`). */
  requests: SkillRequestDto[];
}

export interface AdminSkillRequestDto extends SkillRequestDto {
  partnerId: string;
  partnerName: string | null;
  partnerPhone: string | null;
  /** Skills the partner already has, so the admin sees the context. */
  currentSkills: string[];
}

type Lean = {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  name: string;
  status: SkillRequestStatus;
  reviewNote?: string;
  createdAt: Date;
  reviewedAt?: Date;
};

const toDto = (r: Lean): SkillRequestDto => ({
  id: String(r._id),
  name: r.name,
  status: r.status,
  reviewNote: r.reviewNote ?? null,
  createdAt: r.createdAt.toISOString(),
  reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
});

const keyOf = (name: string) => name.toLowerCase();

async function ownPartner(userId: string) {
  const partner = await PartnerModel.findOne({ userId }).select("_id skills userId").lean<{ _id: Types.ObjectId; skills?: string[]; userId: Types.ObjectId }>();
  if (!partner) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, "Partner profile not found");
  return partner;
}

export const partnerSkillsService = {
  async list(userId: string): Promise<PartnerSkillsDto> {
    const partner = await ownPartner(userId);
    const rows = await SkillRequestModel.find({ partnerId: partner._id, status: { $in: ["pending", "rejected"] } })
      .sort({ createdAt: -1 })
      .lean<Lean[]>();
    return { skills: partner.skills ?? [], requests: rows.map(toDto) };
  },

  async request(userId: string, name: string, ip: string): Promise<SkillRequestDto> {
    const partner = await ownPartner(userId);
    const key = keyOf(name);

    if ((partner.skills ?? []).some((s) => keyOf(s) === key)) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, "You already have this skill");
    }
    const existing = await SkillRequestModel.findOne({ partnerId: partner._id, nameKey: key }).lean<Lean>();
    if (existing?.status === "pending") throw Errors.conflict(ERROR_CODES.CONFLICT, "This skill is already waiting for approval");
    if (existing?.status === "approved") throw Errors.conflict(ERROR_CODES.CONFLICT, "You already have this skill");

    const pending = await SkillRequestModel.countDocuments({ partnerId: partner._id, status: "pending" });
    if (pending >= MAX_PENDING) {
      throw Errors.badRequest(`You can have at most ${MAX_PENDING} skills waiting for approval. Please wait for the admin to review them.`);
    }

    // A rejected request can be sent again: it goes back to pending with the old review cleared.
    const doc = existing
      ? await SkillRequestModel.findByIdAndUpdate(
          existing._id,
          { $set: { name, status: "pending" }, $unset: { reviewNote: 1, reviewedBy: 1, reviewedAt: 1 } },
          { new: true },
        ).lean<Lean>()
      : (await SkillRequestModel.create({ partnerId: partner._id, name, nameKey: key })).toObject() as unknown as Lean;
    if (!doc) throw Errors.notFound(ERROR_CODES.NOT_FOUND, "Request not found");

    const user = await UserModel.findById(userId).select("name").lean<{ name?: string }>();
    void notifyAdmins("skill.requested", {
      message: `${user?.name ?? "A partner"} asked to add the skill "${name}"`,
      partnerId: String(partner._id),
      skillRequestId: String(doc._id),
    }).catch((err) => console.error("[partner-skills] admin alert failed", err));
    void auditService
      .recordAudit({ actor: userId, action: "partner.skill.requested", entity: "SkillRequest", entityId: String(doc._id), before: null, after: { name }, ip, result: "Success" })
      .catch(() => undefined);

    return toDto(doc);
  },

  /** Admin: requests by status, oldest first for pending so nobody waits longest. */
  async adminList(status: SkillRequestStatus): Promise<AdminSkillRequestDto[]> {
    const rows = await SkillRequestModel.find({ status })
      .sort(status === "pending" ? { createdAt: 1 } : { reviewedAt: -1 })
      .limit(100)
      .lean<Lean[]>();
    const partnerIds = [...new Set(rows.map((r) => String(r.partnerId)))];
    const partners = await PartnerModel.find({ _id: { $in: partnerIds } }).select("userId skills").lean<{ _id: Types.ObjectId; userId: Types.ObjectId; skills?: string[] }[]>();
    const users = await UserModel.find({ _id: { $in: partners.map((p) => p.userId) } }).select("name phone").lean<{ _id: Types.ObjectId; name?: string; phone?: string }[]>();
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const partnerById = new Map(partners.map((p) => [String(p._id), p]));
    return rows.map((r) => {
      const p = partnerById.get(String(r.partnerId));
      const u = p ? userById.get(String(p.userId)) : undefined;
      return { ...toDto(r), partnerId: String(r.partnerId), partnerName: u?.name ?? null, partnerPhone: u?.phone ?? null, currentSkills: p?.skills ?? [] };
    });
  },

  async review(adminId: string, id: string, decision: "approved" | "rejected", note: string | undefined, ip: string): Promise<SkillRequestDto> {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound(ERROR_CODES.NOT_FOUND, "Request not found");
    // Only a pending request can be decided, and only once (the filter makes a double click harmless).
    const doc = await SkillRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: decision, reviewedBy: adminId, reviewedAt: new Date(), ...(note ? { reviewNote: note } : {}) } },
      { new: true },
    ).lean<Lean>();
    if (!doc) throw Errors.conflict(ERROR_CODES.CONFLICT, "This request was already reviewed or does not exist");

    const partner = await PartnerModel.findById(doc.partnerId).select("userId").lean<{ userId: Types.ObjectId }>();
    if (decision === "approved") {
      await PartnerModel.updateOne({ _id: doc.partnerId }, { $addToSet: { skills: doc.name } });
    }
    if (partner) {
      void notify(String(partner.userId), "skill.reviewed", {
        message: decision === "approved" ? `Your skill "${doc.name}" was approved` : `Your skill "${doc.name}" was not approved${note ? `: ${note}` : ""}`,
        skill: doc.name,
        decision,
      }).catch(() => undefined);
    }
    void auditService
      .recordAudit({ actor: adminId, action: `partner.skill.${decision}`, entity: "SkillRequest", entityId: id, before: { status: "pending" }, after: { status: decision, name: doc.name, note: note ?? null }, ip, result: "Success" })
      .catch(() => undefined);
    return toDto(doc);
  },
};
