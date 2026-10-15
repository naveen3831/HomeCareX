/** Mirror of frontend/src/pages/partner/Performance/performance.types.ts. Rates are 0-100, rating is 0-5, null = no data yet. */
export interface PerformanceSummaryDto {
  totalJobs: number;
  ratingCount: number;
  rating: number | null;
  acceptanceRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  onTimeRate: number | null;
}

export interface TrendPointDto {
  /** 'YYYY-MM' in business time. */
  period: string;
  rating: number | null;
  acceptanceRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  onTimeRate: number | null;
}

export interface PerformanceTrendsDto {
  points: TrendPointDto[];
}

/** Counts from the bookings collection for one period (or all time). */
export interface JobCounts {
  resolved: number;
  completed: number;
  cancelledByPartner: number;
  /** Completed jobs where an arrival time is known. */
  withArrival: number;
  onTime: number;
}

/** Counts from booking.offers for one period (or all time). */
export interface OfferCounts {
  answered: number;
  accepted: number;
}

export interface RatingStat {
  avg: number;
  count: number;
}