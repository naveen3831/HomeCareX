/** Shared ticket types (partner, customer and admin screens all use these). */

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PARTNER_TICKET_CATEGORIES = [
  { value: "booking", label: "Booking" },
  { value: "customer", label: "Customer" },
  { value: "payment", label: "Payment" },
  { value: "payout", label: "Payout" },
  { value: "kyc", label: "KYC" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
] as const;

export type PartnerTicketCategory =
  (typeof PARTNER_TICKET_CATEGORIES)[number]["value"];

export type TicketSenderRole = "customer" | "partner" | "admin";

export interface TicketAttachment {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Ticket {
  id: string;
  /** Kept as string so older backend values (e.g. "app_issue") still render. */
  category: string;
  subject: string;
  status: TicketStatus;
  bookingId: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: TicketSenderRole;
  body: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function categoryLabel(value: string): string {
  const hit = PARTNER_TICKET_CATEGORIES.find((c) => c.value === value);
  if (hit) return hit.label;
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function shortTicketId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
