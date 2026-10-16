import type { TicketPriority, TicketStatus } from "@/types/adminTicket";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};
