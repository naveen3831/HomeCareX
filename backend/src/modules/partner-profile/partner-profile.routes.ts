import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { UserModel } from "../../models/User";
import { PartnerModel } from "../../models/Partner";

/** Mounted at /partner/profile */
export const partnerProfileRoutes = Router();

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\d{10}$/, "Enter a 10-digit phone number"),
    bio: z.string().trim().max(500, "Bio can be up to 500 characters").optional(),
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
      PartnerModel.findOne({ userId: sub }).select("bio").lean(),
    ]);
    sendSuccess(res, { name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", bio: partner?.bio ?? "" });
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
    const { name, phone, bio } = req.body as z.infer<typeof bodySchema>;
    try {
      await UserModel.updateOne({ _id: sub }, { $set: { name, phone } });
      if (bio !== undefined) await PartnerModel.updateOne({ userId: sub }, { $set: { bio } });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ success: false, message: "That phone number is already in use.", code: "CONFLICT" });
        return;
      }
      throw err;
    }
    sendSuccess(res, { name, phone, ...(bio !== undefined ? { bio } : {}) }, { message: "Profile updated" });
  }),
);

export default partnerProfileRoutes;
