
import type {
  MetricKey,
  PerformanceSummary,
} from "./performance.types";

/**
 * Performance targets.
 * Cancellation is the only metric where a lower value is better.
 */
export const TARGETS = {
  rating: 4.5,
  acceptanceRate: 80,
  completionRate: 95,
  cancellationRate: 5,
  onTimeRate: 90,
} as const;

export interface Tip {
  id: string;
  title: string;
  text: string;
}

/**
 * Returns:
 * true  = target achieved
 * false = target not achieved
 * null  = metric has no data
 */
export function meetsTarget(
  key: MetricKey,
  value: number | null
): boolean | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (key === "cancellationRate") {
    return value <= TARGETS.cancellationRate;
  }

  return value >= TARGETS[key];
}

const percentage = (value: number): string =>
  `${Math.round(value)}%`;

/**
 * Build recommendations dynamically from the scorecard.
 */
export function buildTips(
  summary: PerformanceSummary
): Tip[] {
  const tips: Tip[] = [];

  if (
    meetsTarget("acceptanceRate", summary.acceptanceRate) === false
  ) {
    tips.push({
      id: "acceptance",
      title: "Accept more requests",
      text: `Your acceptance rate is ${percentage(
        summary.acceptanceRate!
      )}. Keep your availability updated and respond to requests promptly.`,
    });
  }

  if (
    meetsTarget("completionRate", summary.completionRate) === false
  ) {
    tips.push({
      id: "completion",
      title: "Complete every accepted job",
      text: `Your completion rate is ${percentage(
        summary.completionRate!
      )}. Plan your schedule carefully and complete the jobs you accept.`,
    });
  }

  if (
    meetsTarget("cancellationRate", summary.cancellationRate) === false
  ) {
    tips.push({
      id: "cancellation",
      title: "Reduce cancellations",
      text: `Your cancellation rate is ${percentage(
        summary.cancellationRate!
      )}. Accept jobs you can attend and update your availability in advance.`,
    });
  }

  if (
    meetsTarget("onTimeRate", summary.onTimeRate) === false
  ) {
    tips.push({
      id: "ontime",
      title: "Arrive on time",
      text: `Your on-time rate is ${percentage(
        summary.onTimeRate!
      )}. Start travelling early, allow for traffic and update your job status when you leave.`,
    });
  }

  if (
    meetsTarget("rating", summary.rating) === false
  ) {
    tips.push({
      id: "rating",
      title: "Improve your customer rating",
      text: `Your current rating is ${summary.rating!.toFixed(
        1
      )}. Communicate clearly, follow the service checklist and confirm customer satisfaction.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: "great",
      title: "Keep up the great work!",
      text: "You are meeting every available performance target. Maintain your service quality, punctuality and communication.",
    });
  }

  return tips;
}
