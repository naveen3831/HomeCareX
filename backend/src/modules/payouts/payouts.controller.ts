import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { PayoutsService } from './payouts.service';

type CsvExportResult = {
  csv: string;
  filename?: string;
};

export class PayoutsController {
  constructor(private readonly service = new PayoutsService()) {}

  /**
   * GET /admin/payouts?page=1&limit=20&status=pending
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await this.service.listBatches({
      page:
        req.query.page === undefined
          ? undefined
          : Number(req.query.page),
      limit:
        req.query.limit === undefined
          ? undefined
          : Number(req.query.limit),
      status:
        typeof req.query.status === 'string'
          ? req.query.status
          : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /admin/payouts
   */
  async generate(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);
    const { periodStart, periodEnd } = req.body ?? {};

    const result = await this.service.generateBatch({
      periodStart,
      periodEnd,
      adminId: user.id,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /admin/payouts/:id
   */
  async getBatch(req: Request, res: Response): Promise<void> {
    const result = await this.service.getBatch(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /admin/payouts/:id/payouts
   */
  async listPayouts(req: Request, res: Response): Promise<void> {
    const result = await this.service.listPayouts(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * PATCH /admin/payouts/:id/mark-paid
   */
  async markPaid(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(req);

    const result = await this.service.markPaid({
      payoutId: String(req.params.id),
      adminId: user.id,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
    });

    res.status(200).json({
      success: true,
      data: result,
    });
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
      // Supports services that return the CSV string directly.
      csv = result;
      filename = `payouts-${batchId}.csv`;
    } else {
      // Supports services that return { csv, filename }.
      const exportResult = result as CsvExportResult;
      csv = exportResult.csv;
      filename =
        typeof exportResult.filename === 'string' &&
        exportResult.filename.trim()
          ? exportResult.filename
          : `payouts-${batchId}.csv`;
    }

    if (typeof csv !== 'string' || csv.trim().length === 0) {
      res.status(404).json({
        success: false,
        message: 'No payout data available to export.',
      });
      return;
    }

    // Prevent unsafe characters in the download filename.
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
