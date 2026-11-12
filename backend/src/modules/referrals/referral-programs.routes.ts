import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { referralProgramsService } from "./referral-programs.service";

/**
 * Admin referral programs.
 * Mounted at /api/v1/admin/referral-programs (authenticate + admin + "coupons" permission are applied in routes/index.ts).
 */
export const referralProgramsRoutes = Router();

referralProgramsRoutes.get(
  "/",
  asyncHandler(async (_req, res) => sendSuccess(res, await referralProgramsService.list())),
);

referralProgramsRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => sendSuccess(res, await referralProgramsService.getById(String(req.params.id)))),
);

referralProgramsRoutes.post(
  "/",
  asyncHandler(async (req, res) =>
    sendSuccess(res, await referralProgramsService.create(req.body), { status: 201 }),
  ),
);

referralProgramsRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => sendSuccess(res, await referralProgramsService.update(String(req.params.id), req.body))),
);

referralProgramsRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await referralProgramsService.remove(String(req.params.id));
    return sendSuccess(res, { deleted: true });
  }),
);
