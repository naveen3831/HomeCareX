
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';
import { PayoutsService } from './payouts.service';

type CsvExportResult = {
  csv: string;
  filename?: string;
};

const getIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown';

const num = (value: unknown): number | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;

export class PayoutsController {
  constructor(
    private readonly service = new PayoutsService(),
  ) {}

  /**
   * GET /admin/payouts?page=1&limit=20&status=pending
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await this.service.listBatches({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
    });

    // Support both service result shapes:
    // { items, pagination } and a direct result object.
    if (
      result &&
      typeof result === 'object' &&
      'items' in result &&
      'pagination' in result
    ) {
      const paginated = result as {
        items: unknown;
        pagination: unknown;
      };

      sendSuccess(res, paginated.items, {
        meta: { pagination: paginated.pagination },
      });
      return;
    }

    sendSuccess(res, result);
  }

  /**
   * POST /admin/payouts
   */
  async generate(req: Request, res: Response): Promise<void> {
    const admin = getAuthUser(req);

    const result = await this.service.generateBatch({
      periodStart: req.body?.periodStart,
      periodEnd: req.body?.periodEnd,
      adminId: admin.id,
      ip: getIp(req),
    });

    sendSuccess(res, result, { status: 201 });
  }

  /**
   * GET /admin/payouts/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    const result = await this.service.getBatch(
      String(req.params.id),
    );

    sendSuccess(res, result);
  }

  /**
   * Backward-compatible alias for routes using getBatch.
   */
  async getBatch(req: Request, res: Response): Promise<void> {
    await this.get(req, res);
  }

  /**
   * GET /admin/payouts/:id/payouts
   */
  async listPayouts(
    req: Request,
    res: Response,
  ): Promise<void> {
    const result = await this.service.listPayouts(
      String(req.params.id),
    );

    sendSuccess(res, result);
  }

  /**
   * PATCH /admin/payouts/:id/mark-paid
   */
  async markPaid(req: Request, res: Response): Promise<void> {
    const admin = getAuthUser(req);

    const result = await this.service.markPaid({
      payoutId: String(req.params.id),
      adminId: admin.id,
      ip: getIp(req),
      transactionId: str(req.body?.transactionId),
    });

    sendSuccess(res, result);
  }

  /**
   * GET /admin/payouts/:id/export
   */
  async exportCsv(req: Request, res: Response): Promise<void> {
    const batchId = String(req.params.id);
    const result = await this.service.exportCsv(batchId);

    let csv: string;
    let filename: string;

    if (typeof result === 'string') {
      csv = result;
      filename = `payouts-${batchId}.csv`;
    } else {
      const exportResult = result as CsvExportResult;
      csv = exportResult.csv;
      filename =
        typeof exportResult.filename === 'string' &&
        exportResult.filename.trim()
          ? exportResult.filename.trim()
          : `payouts-${batchId}.csv`;
    }

    if (typeof csv !== 'string' || csv.trim().length === 0) {
      res.status(404).json({
        success: false,
        message: 'No payout data available to export.',
      });
      return;
    }

    // Keep the downloaded filename safe.
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!filename.toLowerCase().endsWith('.csv')) {
      filename += '.csv';
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }
}

export const payoutsController = new PayoutsController();

export default payoutsController;
