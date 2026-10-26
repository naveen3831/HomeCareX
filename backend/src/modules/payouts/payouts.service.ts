import { Types } from "mongoose";

import { AppError } from "../../utils/AppError";
import PayoutModel from "../../models/Payout";
import PayoutBatchModel from "../../models/PayoutBatch";
import {
  auditService,
  type AuditService,
} from "../audit/audit.service";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PAYOUT_BATCH_STATUSES,
} from "./payouts.constants";
import { payoutsRepository } from "./payouts.repository";
import { payoutsDemoRepository } from "./payouts.demo.repository";
import { alertPayoutFailed } from "../notifications/admin-alerts";
import type {
  GenerateBatchInput,
  ListBatchesInput,
  MarkPaidInput,
  PayoutsRepository,
} from "./payouts.types";
import { isObjectId, parseDate } from "./payouts.validation";

type RepositoryPort = Omit<PayoutsRepository, "markPaid"> &
  Partial<Pick<PayoutsRepository, "markPaid">>;

type PayoutStatus = "pending" | "processing" | "paid" | "failed";

interface PartnerInfo {
  _id?: unknown;
  name?: string;
  email?: string;
}

interface BatchInfo {
  periodStart?: Date | string;
  periodEnd?: Date | string;
}

interface PayoutDocument {
  _id: unknown;
  partnerId: unknown;
  batchId: unknown;
  amount: number;
  status: PayoutStatus;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
}

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["processing", "failed", "paid"],
  processing: ["failed", "paid"],
  failed: ["processing"],
  paid: [],
};

const CSV_HEADERS = [
  "Payout ID",
  "Partner ID",
  "Partner Name",
  "Partner Email",
  "Batch ID",
  "Period Start",
  "Period End",
  "Amount INR",
  "Status",
  "Paid At",
  "Created At",
];

function idToString(value: unknown): string {
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String(value._id ?? "");
  }

  return String(value ?? "");
}

function getPartner(value: unknown): PartnerInfo | null {
  if (typeof value === "object" && value !== null && "name" in value) {
    return value as PartnerInfo;
  }

  return null;
}

function getBatchInfo(value: unknown): BatchInfo | null {
  if (
    typeof value === "object" &&
    value !== null &&
    ("periodStart" in value || "periodEnd" in value)
  ) {
    return value as BatchInfo;
  }

  return null;
}

function toIsoString(
  value: Date | string | null | undefined,
): string {
  if (value == null) return "";

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function escapeCsv(value: unknown): string {
  let text =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  // Prevent spreadsheet formula injection for non-numeric values.
  if (typeof value !== "number" && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: unknown[][]): string {
  return rows
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}

function payoutToCsvRow(payout: PayoutDocument): unknown[] {
  const partner = getPartner(payout.partnerId);
  const batch = getBatchInfo(payout.batchId);

  return [
    idToString(payout._id),
    idToString(payout.partnerId),
    partner?.name ?? "",
    partner?.email ?? "",
    idToString(payout.batchId),
    toIsoString(batch?.periodStart),
    toIsoString(batch?.periodEnd),
    Number(payout.amount).toFixed(2),
    payout.status,
    toIsoString(payout.paidAt),
    toIsoString(payout.createdAt),
  ];
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }

  return "";
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected payout error occurred";
}

function mapRepositoryError(error: unknown): never {
  // Preserve already-mapped application errors.
  if (error instanceof AppError) {
    throw error;
  }

  const code = getErrorCode(error);

  if (code === "INVALID_ADMIN_ID") {
    throw new AppError(401, code, "A valid admin ID is required");
  }

  if (code === "INVALID_PERIOD" || code === "INVALID_PAYOUT_PERIOD") {
    throw new AppError(
      400,
      code,
      "Enter a valid payout period",
    );
  }

  if (
    code === "NO_ELIGIBLE_EARNINGS" ||
    code === "NO_EARNINGS_TO_PAY"
  ) {
    throw new AppError(
      422,
      code,
      "There are no pending earnings in this period",
    );
  }

  if (
    code === "PAYOUT_BATCH_ALREADY_EXISTS" ||
    code === "PAYOUT_EARNINGS_RESERVATION_CONFLICT"
  ) {
    throw new AppError(
      409,
      code,
      "A payout batch already exists or the earnings are already reserved",
    );
  }

  if (code === "INVALID_PAYOUT_ID") {
    throw new AppError(400, code, "Invalid payout ID");
  }

  if (code === "PAYOUT_NOT_FOUND") {
    throw new AppError(404, code, "Payout not found");
  }

  if (code === "PAYOUT_ALREADY_PAID") {
    throw new AppError(
      409,
      code,
      "This payout is already marked as paid",
    );
  }

  if (code === "PAYOUT_STATUS_CONFLICT") {
    throw new AppError(
      409,
      code,
      "The requested payout status transition is not allowed",
    );
  }

  if (code === "INVALID_PAYOUT_STATUS") {
    throw new AppError(400, code, "Invalid payout status");
  }

  // Preserve the original message for unexpected errors where possible.
  throw new AppError(
    500,
    "PAYOUT_OPERATION_FAILED",
    getErrorMessage(error),
  );
}

function isPayoutStatus(value: unknown): value is PayoutStatus {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "paid" ||
    value === "failed"
  );
}

export class PayoutsService {
  constructor(
    private readonly repository: RepositoryPort = payoutsRepository,
    private readonly audit: Pick<AuditService, "recordAudit"> = auditService,
    private readonly demoMode = false,
  ) {}

  private requireAdmin(adminId: string): void {
    if (!isObjectId(adminId)) {
      throw new AppError(
        401,
        "INVALID_ADMIN_ID",
        "A valid admin ID is required",
      );
    }
  }

  private requireBatchId(batchId: string): void {
    if (!isObjectId(batchId)) {
      throw new AppError(
        400,
        "INVALID_BATCH_ID",
        "A valid payout batch ID is required",
      );
    }
  }

  private async record(
    input: Parameters<AuditService["recordAudit"]>[0],
  ): Promise<void> {
    try {
      await this.audit.recordAudit(input);
    } catch (error) {
      console.error("[payouts] Audit log failed", error);
    }
  }

  async generateBatch(input: GenerateBatchInput) {
    this.requireAdmin(input.adminId);

    const periodStart =
      input.periodStart instanceof Date
        ? input.periodStart
        : parseDate(input.periodStart);

    const periodEnd =
      input.periodEnd instanceof Date
        ? input.periodEnd
        : parseDate(input.periodEnd);

    if (
      !periodStart ||
      !periodEnd ||
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime())
    ) {
      throw new AppError(
        400,
        "INVALID_PAYOUT_PERIOD",
        "Enter valid payout period dates",
      );
    }

    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw new AppError(
        400,
        "INVALID_PAYOUT_PERIOD",
        "The period start must be before the period end",
      );
    }

    try {
      const batch = await this.repository.generateBatch({
        periodStart,
        periodEnd,
        adminId: input.adminId,
      });

      await this.record({
        actor: input.adminId,
        action: "PAYOUT_BATCH_GENERATED",
        entity: "PayoutBatch",
        entityId: idToString(batch._id),
        after: {
          periodStart,
          periodEnd,
          gross: batch.gross,
          commission: batch.commission,
          net: batch.net,
          status: batch.status,
        },
        ip: input.ip,
        result: "Success",
      });

      return batch;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async listBatches(input: ListBatchesInput = {}) {
    const page = input.page ?? DEFAULT_PAGE;
    const limit = input.limit ?? DEFAULT_LIMIT;

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(
        400,
        "INVALID_PAGE",
        "Page must be a whole number of 1 or more",
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new AppError(
        400,
        "INVALID_LIMIT",
        `Limit must be between 1 and ${MAX_LIMIT}`,
      );
    }

    if (
      input.status !== undefined &&
      !(PAYOUT_BATCH_STATUSES as readonly string[]).includes(input.status)
    ) {
      throw new AppError(
        400,
        "INVALID_BATCH_STATUS",
        "Unsupported payout batch status",
      );
    }

    return this.repository.listBatches({
      page,
      limit,
      status: input.status,
    });
  }

  async getBatch(batchId: string) {
    this.requireBatchId(batchId);

    const batch = await this.repository.findBatchById(batchId);

    if (!batch) {
      throw new AppError(
        404,
        "PAYOUT_BATCH_NOT_FOUND",
        "Payout batch not found",
      );
    }

    return batch;
  }

  async listPayouts(batchId: string) {
    this.requireBatchId(batchId);

    const batch = await this.repository.findBatchById(batchId);

    if (!batch) {
      throw new AppError(
        404,
        "PAYOUT_BATCH_NOT_FOUND",
        "Payout batch not found",
      );
    }

    return this.repository.listPayouts(batchId);
  }

  async markPaid(input: MarkPaidInput) {
    this.requireAdmin(input.adminId);

    if (!isObjectId(input.payoutId)) {
      throw new AppError(
        400,
        "INVALID_PAYOUT_ID",
        "A valid payout ID is required",
      );
    }

    if (!this.repository.markPaid) {
      throw new AppError(
        501,
        "NOT_SUPPORTED",
        "Marking payouts as paid is not supported by this repository",
      );
    }

    try {
      const payout = await this.repository.markPaid({
        payoutId: input.payoutId,
        transactionId: input.transactionId,
      });

      await this.record({
        actor: input.adminId,
        action: "PAYOUT_MARKED_PAID",
        entity: "Payout",
        entityId: input.payoutId,
        after: {
          status: payout.status,
          amount: payout.amount,
          paidAt: payout.paidAt,
          transactionId: input.transactionId,
        },
        ip: input.ip,
        result: "Success",
      });

      return payout;
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async updateStatus(input: {
    payoutId: string;
    status: unknown;
    adminId: string;
    ip: string;
  }) {
    const { payoutId, status, adminId, ip } = input;

    if (!isObjectId(payoutId)) {
      throw new AppError(400, "INVALID_PAYOUT_ID", "Invalid payout ID");
    }

    this.requireAdmin(adminId);

    if (!isPayoutStatus(status)) {
      throw new AppError(
        400,
        "INVALID_PAYOUT_STATUS",
        "Status must be pending, processing, paid, or failed",
      );
    }

    const nextStatus = status;

    if (this.demoMode) {
      try {
        const updated = await payoutsDemoRepository.updateStatus(
          payoutId,
          nextStatus,
        );

        if (nextStatus === "failed") {
          const payout = updated as unknown as PayoutDocument;
          const partner = getPartner(payout.partnerId);

          alertPayoutFailed({
            payoutId,
            amount: payout.amount,
            partnerId: partner?._id ? String(partner._id) : undefined,
            partnerName: partner?.name,
            batchId: idToString(payout.batchId),
          });
        }

        await this.record({
          actor: adminId,
          action: "PAYOUT_STATUS_UPDATED",
          entity: "Payout",
          entityId: payoutId,
          after: { status: nextStatus },
          ip,
          result: "Success",
        });

        return updated;
      } catch (error) {
        mapRepositoryError(error);
      }
    }

    const beforeResult = await PayoutModel.findById(payoutId).lean();
    const before = beforeResult as unknown as PayoutDocument | null;

    if (!before) {
      throw new AppError(404, "PAYOUT_NOT_FOUND", "Payout not found");
    }

    if (before.status === nextStatus) {
      throw new AppError(
        409,
        before.status === "paid"
          ? "PAYOUT_ALREADY_PAID"
          : "PAYOUT_STATUS_CONFLICT",
        `Payout is already in ${nextStatus} status`,
      );
    }

    if (!allowedTransitions[before.status]?.includes(nextStatus)) {
      throw new AppError(
        409,
        "PAYOUT_STATUS_CONFLICT",
        `Cannot change payout status from ${before.status} to ${nextStatus}`,
      );
    }

    const updatedResult = await PayoutModel.findOneAndUpdate(
      { _id: payoutId, status: before.status },
      {
        $set: {
          status: nextStatus,
          paidAt: nextStatus === "paid" ? new Date() : null,
        },
      },
      { new: true, runValidators: true },
    )
      .populate("partnerId", "name email")
      .populate("batchId", "periodStart periodEnd status")
      .lean();

    const updated = updatedResult as unknown as PayoutDocument | null;

    if (!updated) {
      throw new AppError(
        409,
        "PAYOUT_STATUS_CONFLICT",
        "The payout changed concurrently. Refresh and try again.",
      );
    }

    const batchId = idToString(before.batchId);

    if (Types.ObjectId.isValid(batchId)) {
      const batchObjectId = new Types.ObjectId(batchId);

      const remaining = await PayoutModel.countDocuments({
        batchId: batchObjectId,
        status: { $ne: "paid" },
      });

      let batchStatus = "pending";

      if (remaining === 0) {
        batchStatus = "completed";
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: "processing",
        })
      ) {
        batchStatus = "processing";
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: "paid",
        })
      ) {
        batchStatus = "processing";
      } else if (
        await PayoutModel.exists({
          batchId: batchObjectId,
          status: "failed",
        })
      ) {
        batchStatus = "failed";
      }

      await PayoutBatchModel.findByIdAndUpdate(batchObjectId, {
        $set: { status: batchStatus },
      });
    }

    await this.record({
      actor: adminId,
      action:
        nextStatus === "paid"
          ? "PAYOUT_MARKED_PAID"
          : "PAYOUT_STATUS_UPDATED",
      entity: "Payout",
      entityId: payoutId,
      before: {
        status: before.status,
        paidAt: before.paidAt ?? null,
        amount: before.amount,
      },
      after: {
        status: updated.status,
        paidAt: updated.paidAt ?? null,
        amount: updated.amount,
        batchId,
      },
      ip,
      result: "Success",
    });

    if (nextStatus === "failed") {
      const partner = getPartner(updated.partnerId);

      alertPayoutFailed({
        payoutId,
        amount: updated.amount,
        partnerId: partner?._id ? String(partner._id) : undefined,
        partnerName: partner?.name,
        batchId,
      });
    }

    return updated;
  }

  async exportCsv(batchId?: string): Promise<string> {
    if (batchId) {
      this.requireBatchId(batchId);
      await this.getBatch(batchId);
    }

    if (this.demoMode) {
      const batchesResult = batchId
        ? null
        : await this.repository.listBatches({
            page: 1,
            limit: MAX_LIMIT,
          });

      const batchIds = batchId
        ? [batchId]
        : (
            batchesResult as {
              items?: Array<{ _id: unknown }>;
            }
          )?.items?.map((batch) => String(batch._id)) ?? [];

      const payouts: PayoutDocument[] = [];

      for (const id of batchIds) {
        const result = await this.repository.listPayouts(id);
        payouts.push(...(result as unknown as PayoutDocument[]));
      }

      return buildCsv([
        CSV_HEADERS,
        ...payouts.map(payoutToCsvRow),
      ]);
    }

    const filter: Record<string, unknown> = {};

    if (batchId) {
      filter.batchId = new Types.ObjectId(batchId);
    }

    const results = await PayoutModel.find(filter)
      .populate("partnerId", "name email")
      .populate("batchId", "periodStart periodEnd status")
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const payouts = results as unknown as PayoutDocument[];

    return buildCsv([
      CSV_HEADERS,
      ...payouts.map(payoutToCsvRow),
    ]);
  }
}

const payoutsDemoMode =
  process.env.NODE_ENV === "development" &&
  process.env.PAYOUTS_DEMO_MODE === "true";

export const payoutsService = payoutsDemoMode
  ? new PayoutsService(
      payoutsDemoRepository as unknown as RepositoryPort,
      auditService,
      true,
    )
  : new PayoutsService();

export default payoutsService;
