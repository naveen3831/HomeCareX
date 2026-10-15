import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

/** Mounted at /api/v1/admin/tickets. */
export const adminTicketsRoutes = Router();
adminTicketsRoutes.use(authenticate, requireAdmin);

adminTicketsRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: [],
      message: "Ticket queue is not configured yet.",
    });
  }),
);

adminTicketsRoutes.patch(
  "/:id/assign",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: null,
      message: "Ticket assignment is not configured yet.",
    });
  }),
);

/** Mounted at /api/v1/admin/staff. */
export const adminStaffRoutes = Router();
adminStaffRoutes.use(authenticate, requireAdmin);

adminStaffRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: [],
      message: "No staff are configured for assignment yet.",
    });
  }),
);

export default adminTicketsRoutes;
