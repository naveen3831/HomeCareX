import { Request, Response, NextFunction } from "express";
import { payoutsService } from "./payouts.service";
import { AppError } from "../../utils/AppError";

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    _id?: string;
    userId?: string;
    role?: string;
  };
  admin?: {
    id?: string;
    _id?: string;
  };
};

function getAdminId(req: AuthenticatedRequest): string {
  const user = req.user;
  const admin = req.admin;

  return String(
    admin?.id ??
      admin?._id ??
      user?.id ??
      user?._id ??
      user?.userId ??
      "",
  );
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "";
}

function getRouteId(req: Request): string {
  return String(
    req.params.batchId ??
      req.params.payoutId ??
      req.params.id ??
      "",
  );
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      "Pagination values must be positive integers",
    );
  }

  return parsed;
}

function asyncHandler(
  handler: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => Promise<unknown>,
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    Promise.resolve(
      handler(req as AuthenticatedRequest, res, next),
    ).catch(next);
  };
}

export class PayoutsController {
  /**
   * POST /admin/payouts
   * Generate a payout batch.
   */
  generateBatch = asyncHandler(async (req, res) => {
    const adminId = getAdminId(req);

    const result = await payoutsService.generateBatch({
      adminId,
      periodStart: req.body?.periodStart,
      periodEnd: req.body?.periodEnd,
      ip: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      message: "Payout batch generated successfully",
      data: result,
    });
  });

  /**
   * GET /admin/payouts
   * List payout batches.
   */
  listBatches = asyncHandler(async (req, res) => {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 20);

    const result = await payoutsService.listBatches({
      page,
      limit,
      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /admin/payouts/:id
   * Also supports /admin/payouts/batches/:batchId.
   */
  getBatch = asyncHandler(async (req, res) => {
    const batchId = getRouteId(req);

    const result = await payoutsService.getBatch(batchId);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /admin/payouts/:id/payouts
   * Also supports /admin/payouts/batches/:batchId/payouts.
   */
  listPayouts = asyncHandler(async (req, res) => {
    const batchId = getRouteId(req);

    const result = await payoutsService.listPayouts(batchId);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * PATCH /admin/payouts/:id/mark-paid
   * PATCH /admin/payouts/:id
   * Mark an individual payout as paid.
   */
  markPaid = asyncHandler(async (req, res) => {
    const payoutId = getRouteId(req);

    const result = await payoutsService.markPaid({
      payoutId,
      adminId: getAdminId(req),
      transactionId: req.body?.transactionId,
      ip: getClientIp(req),
    });

    res.status(200).json({
      success: true,
      message: "Payout marked as paid successfully",
      data: result,
    });
  });

  /**
   * PATCH /admin/payouts/:id/status
   * Update an individual payout status.
   */
  updateStatus = asyncHandler(async (req, res) => {
    const payoutId = getRouteId(req);

    const result = await payoutsService.updateStatus({
      payoutId,
      status: req.body?.status,
      adminId: getAdminId(req),
      ip: getClientIp(req),
    });

    res.status(200).json({
      success: true,
      message: "Payout status updated successfully",
      data: result,
    });
  });

  /**
   * GET /admin/payouts/export
   * GET /admin/payouts/:id/export
   */
  exportCsv = asyncHandler(async (req, res) => {
    const batchId =
      typeof req.query.batchId === "string"
        ? req.query.batchId
        : req.params.batchId ?? req.params.id;

    const result = await payoutsService.exportCsv(batchId);

    if (typeof result === "string") {
      res
        .status(200)
        .type("text/csv")
        .setHeader(
          "Content-Disposition",
          'attachment; filename="payouts.csv"',
        )
        .send(result);

      return;
    }

    res
      .status(200)
      .type("text/csv")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`,
      )
      .send(result.csv);
  });
}

export const payoutsController = new PayoutsController();

export default payoutsController;
