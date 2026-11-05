import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { UserModel } from "../../models/User";
import PartnerModel from "../../models/Partner";
import CategoryModel from "../../models/Category";

/** Mounted at /partner/profile */
export const partnerProfileRoutes = Router();

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\d{10}$/, "Enter a 10-digit phone number"),
  })
  .strict();

const base = [authenticate, requireRole("partner")];

// GET /api/v1/partner/profile
partnerProfileRoutes.get(
  "/",
  ...base,
  requirePermission("partner:settings:read"),
  asyncHandler(async (_req, res) => {
    const { sub } = res.locals.auth as { sub: string };
    const [user, partner] = await Promise.all([
      UserModel.findById(sub).select("name phone email").lean(),
      PartnerModel.findOne({ userId: sub }).select("address categories skills serviceRadiusKm bankDetails").lean(),
    ]);
    const categories = partner?.categories?.length
      ? await CategoryModel.find({ _id: { $in: partner.categories } }).select("name").lean()
      : [];
    const a = partner?.address;
    const bank = partner?.bankDetails;
    sendSuccess(res, {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      // What the partner gave when joining (and later changes). Read fresh each time so edits show at once.
      joined: {
        address: {
          line1: a?.line1 ?? "",
          city: a?.city ?? "",
          state: a?.state ?? "",
          pincode: a?.pincode ?? "",
        },
        categories: categories.map((c) => c.name),
        skills: partner?.skills ?? [],
        serviceRadiusKm: partner?.serviceRadiusKm ?? null,
        // Never the full account number: only what is stored (last 4 digits).
        bank: bank && (bank.accountHolder || bank.accountLast4 || bank.ifsc || bank.upiId)
          ? {
              accountHolder: bank.accountHolder ?? "",
              accountLast4: bank.accountLast4 ?? "",
              ifsc: bank.ifsc ?? "",
              upiId: bank.upiId ?? "",
            }
          : null,
      },
    });
  }),
);

// PATCH /api/v1/partner/profile  { name, phone }
partnerProfileRoutes.patch(
  "/",
  ...base,
  requirePermission("partner:settings:write"),
  validate(bodySchema, "body"),
  asyncHandler(async (req, res) => {
    const { sub } = res.locals.auth as { sub: string };
    const { name, phone } = req.body as z.infer<typeof bodySchema>;
    try {
      await UserModel.updateOne({ _id: sub }, { $set: { name, phone } });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ success: false, message: "That phone number is already in use.", code: "CONFLICT" });
        return;
      }
      throw err;
    }
    sendSuccess(res, { name, phone }, { message: "Profile updated" });
  }),
);

export default partnerProfileRoutes;
