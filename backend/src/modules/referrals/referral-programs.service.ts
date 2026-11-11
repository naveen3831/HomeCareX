import { Types } from "mongoose";
import { z } from "zod";
import { ReferralProgramModel, REFERRAL_SCOPES } from "./referral-programs.model";
import { ServiceModel } from "../../models/Service";
import { HttpError } from "../auth/auth.types";

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, "Invalid id");

const baseSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  scope: z.enum(REFERRAL_SCOPES),
  categoryIds: z.array(objectId).default([]),
  serviceIds: z.array(objectId).default([]),
  discountType: z.enum(["PERCENT", "FLAT"]),
  value: z.number().min(0, "Value cannot be negative"),
  maxDiscount: z.number().min(0).nullable().optional(),
  minOrder: z.number().min(0).default(0),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
});

function refine(
  data: Partial<z.infer<typeof baseSchema>>,
  ctx: z.RefinementCtx,
  full: boolean,
) {
  if (data.discountType === "PERCENT" && data.value !== undefined && data.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage value cannot exceed 100" });
  }
  if (data.value !== undefined && data.value <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Discount must be greater than 0" });
  }
  if (data.startAt && data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "End date must be after start date" });
  }
  if (full || data.scope !== undefined) {
    if (data.scope === "CATEGORY" && !(data.categoryIds?.length))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryIds"], message: "Select at least one category" });
    if (data.scope === "SERVICE" && !(data.serviceIds?.length))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceIds"], message: "Select at least one service" });
  }
}

const createSchema = baseSchema.superRefine((d, ctx) => refine(d, ctx, true));
const updateSchema = baseSchema.partial().superRefine((d, ctx) => refine(d, ctx, false));

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const error = new HttpError(422, "Invalid referral data", "VALIDATION_ERROR");
  error.details = parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  throw error;
}

/** Only the ids that the chosen scope uses are kept, so a stale list can never widen a program. */
function normalizeScope<T extends { scope?: string; categoryIds?: string[]; serviceIds?: string[] }>(d: T): T {
  if (d.scope === "ALL") return { ...d, categoryIds: [], serviceIds: [] };
  if (d.scope === "CATEGORY") return { ...d, serviceIds: [] };
  if (d.scope === "SERVICE") return { ...d, categoryIds: [] };
  return d;
}

interface ProgramLike {
  _id: Types.ObjectId;
  name: string;
  scope: "ALL" | "CATEGORY" | "SERVICE";
  categoryIds?: Types.ObjectId[];
  serviceIds?: Types.ObjectId[];
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscount?: number | null;
  minOrder?: number;
  startAt?: Date | null;
  endAt?: Date | null;
  active: boolean;
  usedCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const toDto = (p: ProgramLike) => ({
  id: String(p._id),
  name: p.name,
  scope: p.scope,
  categoryIds: (p.categoryIds ?? []).map(String),
  serviceIds: (p.serviceIds ?? []).map(String),
  discountType: p.discountType,
  value: p.value,
  maxDiscount: p.maxDiscount ?? null,
  minOrder: p.minOrder ?? 0,
  startAt: p.startAt ? p.startAt.toISOString() : null,
  endAt: p.endAt ? p.endAt.toISOString() : null,
  active: p.active,
  usedCount: p.usedCount ?? 0,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export type ReferralProgramDto = ReturnType<typeof toDto>;

const notFound = () => new HttpError(404, "Referral program not found", "NOT_FOUND");

/** Does this program cover the given service? */
export function programCoversService(
  p: Pick<ProgramLike, "scope" | "categoryIds" | "serviceIds">,
  serviceId: string,
  categoryId: string,
): boolean {
  if (p.scope === "ALL") return true;
  if (p.scope === "CATEGORY") return (p.categoryIds ?? []).some((c) => String(c) === categoryId);
  return (p.serviceIds ?? []).some((s) => String(s) === serviceId);
}

export function programDiscount(
  p: Pick<ProgramLike, "discountType" | "value" | "maxDiscount">,
  orderValue: number,
): number {
  let discount = p.discountType === "PERCENT" ? Math.round((orderValue * p.value) / 100) : p.value;
  if (p.maxDiscount !== null && p.maxDiscount !== undefined) discount = Math.min(discount, p.maxDiscount);
  return Math.max(0, Math.min(discount, orderValue));
}

export const referralProgramsService = {
  async list(): Promise<ReferralProgramDto[]> {
    const rows = await ReferralProgramModel.find().sort({ createdAt: -1 }).lean();
    return rows.map((r) => toDto(r as unknown as ProgramLike));
  },

  async getById(id: string): Promise<ReferralProgramDto> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const row = await ReferralProgramModel.findById(id).lean();
    if (!row) throw notFound();
    return toDto(row as unknown as ProgramLike);
  },

  async create(input: unknown): Promise<ReferralProgramDto> {
    const data = normalizeScope(parse(createSchema, input));
    const row = await ReferralProgramModel.create(data);
    return toDto(row.toObject() as unknown as ProgramLike);
  },

  async update(id: string, input: unknown): Promise<ReferralProgramDto> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const existing = await ReferralProgramModel.findById(id).lean();
    if (!existing) throw notFound();
    const patch = parse(updateSchema, input);
    const current = toDto(existing as unknown as ProgramLike);
    // Validate the merged result, so switching to SERVICE without choosing services is rejected.
    const merged = normalizeScope(
      parse(createSchema, {
        name: current.name,
        scope: current.scope,
        categoryIds: current.categoryIds,
        serviceIds: current.serviceIds,
        discountType: current.discountType,
        value: current.value,
        maxDiscount: current.maxDiscount,
        minOrder: current.minOrder,
        startAt: current.startAt,
        endAt: current.endAt,
        active: current.active,
        ...patch,
      }),
    );
    const row = await ReferralProgramModel.findByIdAndUpdate(id, { $set: merged }, { new: true, runValidators: true });
    if (!row) throw notFound();
    return toDto(row.toObject() as unknown as ProgramLike);
  },

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const row = await ReferralProgramModel.findByIdAndDelete(id);
    if (!row) throw notFound();
  },

  /**
   * The discount of ONE specific program (the offer whose code the friend signed up with).
   * null when it is inactive/outside its dates, below the minimum order, or does not cover the service.
   */
  async forProgram(programId: string, serviceId: string, orderValue: number) {
    if (!Types.ObjectId.isValid(programId)) return null;
    const [service, row] = await Promise.all([
      ServiceModel.findById(serviceId).select("categoryId").lean<{ categoryId?: Types.ObjectId }>(),
      ReferralProgramModel.findById(programId).lean(),
    ]);
    if (!service?.categoryId || !row) return null;
    const p = row as unknown as ProgramLike;
    const now = new Date();
    if (!p.active || (p.startAt && p.startAt > now) || (p.endAt && p.endAt < now)) return null;
    if (orderValue < (p.minOrder ?? 0)) return null;
    if (!programCoversService(p, serviceId, String(service.categoryId))) return null;
    const discount = programDiscount(p, orderValue);
    return discount > 0 ? { programId: String(p._id), name: p.name, discount } : null;
  },

  /**
   * Best active program for a service (the one that gives the customer the biggest discount).
   * `orderValue` is base price x quantity + add-ons, the same value coupons use.
   */
  async bestFor(serviceId: string, orderValue: number) {
    const service = await ServiceModel.findById(serviceId).select("categoryId").lean<{ categoryId?: Types.ObjectId }>();
    if (!service?.categoryId) return null;
    const now = new Date();
    const rows = await ReferralProgramModel.find({
      active: true,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    }).lean();
    let best: { programId: string; name: string; discount: number } | null = null;
    for (const p of rows as unknown as ProgramLike[]) {
      if (orderValue < (p.minOrder ?? 0)) continue;
      if (!programCoversService(p, serviceId, String(service.categoryId))) continue;
      const discount = programDiscount(p, orderValue);
      if (discount > 0 && (!best || discount > best.discount)) best = { programId: String(p._id), name: p.name, discount };
    }
    return best;
  },
};