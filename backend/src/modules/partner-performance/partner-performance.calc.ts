import type { JobCounts, OfferCounts, PerformanceSummaryDto, RatingStat, TrendPointDto } from './partner-performance.types';

/** Percentage with one decimal, or null when there is nothing to divide by (so the UI shows "No data", not 0%). */
export const rate = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export const EMPTY_JOBS: JobCounts = { resolved: 0, completed: 0, cancelledByPartner: 0, withArrival: 0, onTime: 0 };
export const EMPTY_OFFERS: OfferCounts = { answered: 0, accepted: 0 };

export function buildSummary(
  partner: { ratingAvg?: number | null; ratingCount?: number | null },
  jobs: JobCounts,
  offers: OfferCounts,
): PerformanceSummaryDto {
  const ratingCount = partner.ratingCount ?? 0;
  return {
    totalJobs: jobs.resolved,
    ratingCount,
    rating: ratingCount > 0 && partner.ratingAvg != null ? round1(partner.ratingAvg) : null,
    acceptanceRate: rate(offers.accepted, offers.answered),
    completionRate: rate(jobs.completed, jobs.resolved),
    cancellationRate: rate(jobs.cancelledByPartner, jobs.resolved),
    onTimeRate: rate(jobs.onTime, jobs.withArrival),
  };
}

export function buildPoint(period: string, jobs: JobCounts, offers: OfferCounts, rating: RatingStat | undefined): TrendPointDto {
  return {
    period,
    rating: rating && rating.count > 0 ? round1(rating.avg) : null,
    acceptanceRate: rate(offers.accepted, offers.answered),
    completionRate: rate(jobs.completed, jobs.resolved),
    cancellationRate: rate(jobs.cancelledByPartner, jobs.resolved),
    onTimeRate: rate(jobs.onTime, jobs.withArrival),
  };
}

/** The last `count` calendar months in business time, oldest first, as 'YYYY-MM' (the current month is last). */
export function lastMonths(now: Date, count: number, offsetMinutes: number): string[] {
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}