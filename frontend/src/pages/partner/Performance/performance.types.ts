
export type MetricKey =
  | "rating"
  | "acceptanceRate"
  | "completionRate"
  | "cancellationRate"
  | "onTimeRate";

export interface PerformanceSummary {
  totalJobs: number;
  ratingCount: number;

  /** Rating from 0 to 5; null means no data. */
  rating: number | null;

  /** Percentage values from 0 to 100. */
  acceptanceRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  onTimeRate: number | null;
}

export interface TrendPoint {
  /** Month in YYYY-MM format or an ISO date. */
  period: string;

  rating: number | null;
  acceptanceRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  onTimeRate: number | null;
}

export interface PerformanceTrends {
  points: TrendPoint[];
}
