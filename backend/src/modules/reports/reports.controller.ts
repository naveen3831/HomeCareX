
import type { Request, Response } from 'express';
import { reportsService, ReportsService } from './reports.service';
import { reportsValidation } from './reports.validation';

function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined ? '' : String(value);

  // Prevent spreadsheet formula injection.
  if (/^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export class ReportsController {
  constructor(
    private readonly service: ReportsService = reportsService,
  ) {}

  private parseQuery(
    req: Request,
    res: Response,
    reportType: 'bookings' | 'revenue' | 'partners',
  ) {
    const result = reportsValidation.query({
      ...req.query,
      type: reportType,
    });

    if (!result.success || !result.data) {
      res.status(400).json({
        success: false,
        message: 'Invalid report filters.',
        errors: result.errors,
      });
      return undefined;
    }

    return result.data;
  }

  async bookings(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'bookings');
    if (!input) return;

    const report = await this.service.bookings(input);
    res.json({ success: true, ...report });
  }

  async revenue(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'revenue');
    if (!input) return;

    const report = await this.service.revenue(input);
    res.json({ success: true, ...report });
  }

  async partners(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'partners');
    if (!input) return;

    const report = await this.service.partners(input);
    res.json({ success: true, ...report });
  }

  async exportBookings(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'bookings');
    if (!input) return;

    const cursor = this.service.exportBookings(input);

    await this.streamCsv(
      req,
      res,
      cursor,
      `homecarex-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Booking ID',
        'Created At',
        'Service',
        'City',
        'Category ID',
        'Partner ID',
        'Status',
        'Payment Status',
        'Total INR',
        'Discount INR',
        'Convenience Fee INR',
        'Partner Earning INR',
      ],
      (row) => [
        row._id,
        row.createdAt,
        row.serviceName,
        row.address?.city,
        row.categoryId,
        row.partnerId,
        row.status,
        row.paymentStatus,
        row.priceBreakdown?.total ?? 0,
        row.priceBreakdown?.discount ?? 0,
        row.priceBreakdown?.convenienceFee ?? 0,
        row.partnerEarning ?? 0,
      ],
    );
  }

  async exportRevenue(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'revenue');
    if (!input) return;

    const cursor = this.service.exportRevenue(input);

    await this.streamCsv(
      req,
      res,
      cursor,
      `homecarex-revenue-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Booking ID',
        'Created At',
        'Service',
        'City',
        'Status',
        'Payment Status',
        'Gross Booking Value INR',
        'Commission INR',
        'Convenience Fee INR',
        'Discount INR',
        'Refund INR',
        'Net Revenue INR',
      ],
      (row) => [
        row._id,
        row.createdAt,
        row.serviceName,
        row.address?.city,
        row.status,
        row.paymentStatus,
        row.priceBreakdown?.total ?? 0,
        row.commission ?? 0,
        row.priceBreakdown?.convenienceFee ?? 0,
        row.priceBreakdown?.discount ?? 0,
        row.refund ?? 0,
        row.netRevenue ?? 0,
      ],
    );
  }

  async exportPartners(req: Request, res: Response): Promise<void> {
    const input = this.parseQuery(req, res, 'partners');
    if (!input) return;

    const report = await this.service.partners({
      ...input,
      page: 1,
      limit: 100,
    });

    const rows = report.data;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="homecarex-partners-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    );

    res.write(
      [
        'Partner ID',
        'Partner Name',
        'Total Bookings',
        'Completed Bookings',
        'Cancelled Bookings',
        'Completion Rate (%)',
        'Gross Earnings INR',
        'Commission INR',
        'Net Earnings INR',
        'Average Rating',
        'Rating Count',
      ]
        .map(csvCell)
        .join(',') + '\r\n',
    );

    for (const row of rows) {
      if (res.destroyed) return;

      const values = [
        row.partnerId,
        row.partnerName,
        row.totalBookings,
        row.completedBookings,
        row.cancelledBookings,
        row.completionRate,
        row.grossEarnings,
        row.commission,
        row.netEarnings,
        row.averageRating ?? 0,
        row.ratingCount ?? 0,
      ];

      if (!res.write(values.map(csvCell).join(',') + '\r\n')) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            cleanup();
            resolve();
          };

          const onError = (error: Error) => {
            cleanup();
            reject(error);
          };

          const cleanup = () => {
            res.off('drain', onDrain);
            res.off('error', onError);
          };

          res.once('drain', onDrain);
          res.once('error', onError);
        });
      }
    }

    if (!res.destroyed) {
      res.end();
    }
  }

  private async streamCsv<T extends object>(
    req: Request,
    res: Response,
    cursor: AsyncIterable<T> & {
      close: () => Promise<unknown>;
    },
    filename: string,
    headers: string[],
    getValues: (row: T) => unknown[],
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    const onClientClose = () => {
      if (!res.writableEnded) {
        void cursor.close().catch(() => undefined);
      }
    };

    res.once('close', onClientClose);

    try {
      res.write(`${headers.map(csvCell).join(',')}\r\n`);

      for await (const row of cursor) {
        if (res.destroyed) return;

        const line = `${getValues(row).map(csvCell).join(',')}\r\n`;

        if (!res.write(line)) {
          await new Promise<void>((resolve, reject) => {
            const onDrain = () => {
              cleanup();
              resolve();
            };

            const onError = (error: Error) => {
              cleanup();
              reject(error);
            };

            const cleanup = () => {
              res.off('drain', onDrain);
              res.off('error', onError);
            };

            res.once('drain', onDrain);
            res.once('error', onError);
          });
        }
      }

      if (!res.destroyed) {
        res.end();
      }
    } catch (error) {
      await cursor.close().catch(() => undefined);

      if (!res.headersSent) {
        throw error;
      }

      if (!res.destroyed) {
        res.destroy(error instanceof Error ? error : undefined);
      }
    } finally {
      res.off('close', onClientClose);
    }
  }
}

export const reportsController = new ReportsController();
