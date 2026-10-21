
import {
  reportsRepository,
  ReportsRepository,
} from './reports.repository';
import { reportsValidation } from './reports.validation';
import type {
  ReportFilters,
  ReportsTypes,
} from './reports.types';

export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository = reportsRepository,
  ) {}

  private toFilters(input: ReportsTypes): ReportFilters {
    return reportsValidation.filters(input);
  }

  private getReportFilters(input: ReportsTypes) {
    return {
      from: input.from,
      to: input.to,
      city: input.city,
      category: input.category,
      status: input.status,
      partner: input.partner,
    };
  }

  async bookings(input: ReportsTypes) {
    const filters = this.toFilters(input);
    const skip = (input.page - 1) * input.limit;

    const [total, data, summary] = await Promise.all([
      this.repository.countBookings(filters),
      this.repository.listBookings(filters, skip, input.limit),
      this.repository.bookingSummary(filters),
    ]);

    return {
      reportType: 'bookings' as const,
      filters: this.getReportFilters(input),
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
      summary,
      data,
    };
  }

  async revenue(input: ReportsTypes) {
    const filters = this.toFilters(input);

    const [total, summary] = await Promise.all([
      this.repository.countBookings(filters),
      this.repository.revenueSummary(filters),
    ]);

    return {
      reportType: 'revenue' as const,
      filters: this.getReportFilters(input),
      total,
      summary,
    };
  }

  async partners(input: ReportsTypes) {
    const filters = this.toFilters(input);
    const skip = (input.page - 1) * input.limit;

    const report = await this.repository.partnerPerformance(
      filters,
      skip,
      input.limit,
    );

    return {
      reportType: 'partners' as const,
      filters: this.getReportFilters(input),
      page: input.page,
      limit: input.limit,
      total: report.total,
      totalPages: Math.ceil(report.total / input.limit),
      summary: report.summary,
      data: report.data,
    };
  }

  exportBookings(input: ReportsTypes) {
    return this.repository.exportBookings(this.toFilters(input));
  }

  exportRevenue(input: ReportsTypes) {
    return this.repository.exportRevenue(this.toFilters(input));
  }
}

export const reportsService = new ReportsService();
