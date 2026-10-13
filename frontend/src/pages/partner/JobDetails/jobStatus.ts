export const LIFECYCLE = [
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
] as const;

export type JobStatus =
  | (typeof LIFECYCLE)[number]
  | "rated"
  | "searching_for_partner"
  | "cancelled_by_customer"
  | "cancelled_by_partner"
  | "cancelled_by_admin"
  | "no_show"
  | "disputed";

export const STATUS_LABEL: Record<string, string> = {
  searching_for_partner: "Searching for partner",
  assigned: "Assigned",
  en_route: "On the way",
  arrived: "Arrived",
  in_progress: "In progress",
  completed: "Completed",
  rated: "Rated",
  cancelled_by_customer: "Cancelled by customer",
  cancelled_by_partner: "Cancelled by partner",
  cancelled_by_admin: "Cancelled by admin",
  no_show: "No show",
  disputed: "Disputed",
};

export const isCancelled = (status: string): boolean =>
  status === "cancelled_by_customer" ||
  status === "cancelled_by_partner" ||
  status === "cancelled_by_admin" ||
  status === "no_show";

export const isFinished = (status: string): boolean =>
  status === "completed" || status === "rated" || isCancelled(status);
