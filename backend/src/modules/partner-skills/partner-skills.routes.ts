import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validationMiddleware } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { SKILL_REQUEST_STATUSES, type SkillRequestStatus } from "./SkillRequest";
import { partnerSkillsService as service } from "./partner-skills.service";
import { requestSkillSchema, reviewSkillSchema, type RequestSkillBody, type ReviewSkillBody } from "./partner-skills.validation";

const sub = (res: Response) => (res.locals.auth as { sub: string }).sub;

/** Mounted at /partner/skills. */
export const partnerSkillsRoutes = Router();
partnerSkillsRoutes.get(
  "/",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:profile:read"),
  asyncHandler(async (_req: Request, res: Response) => sendSuccess(res, await service.list(sub(res)))),
);
// POST /api/v1/partner/skills { name }  -> a pending request the admin must approve
partnerSkillsRoutes.post(
  "/",
  authenticate,
  requireRole("partner"),
  requirePermission("partner:profile:update"),
  validationMiddleware(requestSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const out = await service.request(sub(res), (req.body as RequestSkillBody).name, req.ip || "unknown");
    sendSuccess(res, out, { status: 201, message: "Sent for admin approval" });
  }),
);

/**
 * Mounted at /admin/skill-requests with authMiddleware + requireAdmin + requireResourceAccess("partners"):
 * GET needs partners:view, POST needs partners:update.
 */
export const adminSkillRequestsRoutes = Router();
adminSkillRequestsRoutes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const raw = String(req.query.status ?? "pending");
    const status = (SKILL_REQUEST_STATUSES as readonly string[]).includes(raw) ? (raw as SkillRequestStatus) : "pending";
    sendSuccess(res, await service.adminList(status));
  }),
);
adminSkillRequestsRoutes.post(
  "/:id/approve",
  validationMiddleware(reviewSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await service.review(sub(res), req.params.id, "approved", (req.body as ReviewSkillBody).note, req.ip || "unknown"), { message: "Skill approved" });
  }),
);
adminSkillRequestsRoutes.post(
  "/:id/reject",
  validationMiddleware(reviewSkillSchema),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await service.review(sub(res), req.params.id, "rejected", (req.body as ReviewSkillBody).note, req.ip || "unknown"), { message: "Skill rejected" });
  }),
);
