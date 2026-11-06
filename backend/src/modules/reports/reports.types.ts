
import type { ReportType } from './reports.constants';

export interface ReportsTypes {
  reportType: ReportType;
  from?: string;
  to?: string;
  city?: string;
  category?: string;
  status?: string;
  partner?: string;
  page: number;
  limit: number;
}

export interface ReportFilters {
  from?: Date;
  toExclusive?: Date;
  city?: string;
  categoryId?: string;
  status?: string;
  partnerId?: string;
}

export interface BookingReportRow {
  bookingId: string;
  createdAt: string;
  serviceName: string;
  city: string;
  customerName: string;
  categoryName: string;
  categoryId: string;
  partnerId: string;
  status: string;
  paymentStatus: string;
  total: number;
  discount: number;
  convenienceFee: number;
  partnerEarning: number;
}

export interface BookingReportSummary {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
  averageOrderValue: number;
}

export interface RevenueReportSummary {
  grossBookingValue: number;
  commission: number;
  convenienceFees: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  paidBookings: number;
}

/**
 * Partner performance report row.
 * Monetary values use the same currency units as the existing reports.
 */
export interface PartnerPerformanceReportRow {
  partnerId: string;
  partnerName: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
  grossEarnings: number;
  commission: number;
  netEarnings: number;
  averageRating?: number;
  ratingCount?: number;
}

export interface PartnerPerformanceReportSummary {
  totalPartners: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  grossEarnings: number;
  commission: number;
  netEarnings: number;
}

export interface PaginatedReport<T> {
  reportType: ReportType;
  filters: {
    from?: string;
    to?: string;
    city?: string;
    category?: string;
    status?: string;
    partner?: string;
  };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

export interface ReportsError {
  message: string;
  code?: string;
}
