import type { ReviewStatus } from "@/services/reviewsApi";

export const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

/** How a review's moderation status reads to the customer, plus its colour classes. */
export const STATUS_META: Record<ReviewStatus, { label: string; hint: string; className: string }> = {
  pending: { label: "Pending validation", hint: "Our team is checking this review.", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  approved: { label: "Published", hint: "Visible on the service page.", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Not approved", hint: "This review did not meet our guidelines.", className: "bg-red-50 text-red-800 ring-red-200" },
};

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

/** "12 Oct 2026". Falls back to an empty string for a bad date so the UI never shows "Invalid Date". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

export type ReviewsTab = "pending" | "mine";
export const isReviewsTab = (v: string | null): v is ReviewsTab => v === "pending" || v === "mine";
